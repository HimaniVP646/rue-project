import os
import json
from flask import Flask, request, jsonify, render_template
from groq import Groq

app = Flask(__name__)

try:
    groq_key = os.environ.get("GROQ_API_KEY", "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")
    client = Groq(api_key=groq_key)
    USE_AI = bool(groq_key)
except Exception:
    USE_AI = False
    client = None

def call_claude(prompt: str) -> str:
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        max_tokens=800,
        messages=[{"role": "user", "content": prompt}]
    )
    return response.choices[0].message.content.strip()

def generate_answer(question: str) -> dict:
    if USE_AI:
        prompt = f"""Answer the following question clearly in 3-4 sentences.
Then on a NEW LINE write exactly: CONCEPTS: term1, term2, term3
List 5-7 key technical or conceptual terms from your answer that a beginner might not understand.
Do NOT include words like "is", "the", "a", "and".

Question: {question}"""
        raw = call_claude(prompt)
        if "CONCEPTS:" in raw:
            parts = raw.split("CONCEPTS:")
            answer = parts[0].strip()
            concepts = [c.strip() for c in parts[1].split(",") if c.strip()][:8]
        else:
            answer = raw
            concepts = []
        return {"answer": answer, "concepts": concepts}
    else:
        return mock_answer(question)

def explain_concept(concept: str, context: str = "") -> dict:
    if USE_AI:
        ctx = f" in the context of '{context}'" if context else ""
        prompt =prompt = f"""Your task has TWO parts:

PART 1: Explain "{concept}"{ctx} in 2-3 sentences for a beginner. Be clear and simple.

PART 2: After your explanation, write this EXACTLY:
SUBCONCEPTS: [pick 3-4 actual technical words FROM your explanation above]

STRICT RULES:
- NEVER write "term1", "term2", "term3" or any placeholders
- ONLY use real words that actually appear in your Part 1 explanation
- Do NOT repeat the same words every time
- Do NOT include "{concept}" itself as a subconcept
- Each subconcept must be DIFFERENT from the parent concept
- Example format: SUBCONCEPTS: algorithm, dataset, prediction, training"""
        raw = call_claude(prompt)
        if "SUBCONCEPTS:" in raw:
            parts = raw.split("SUBCONCEPTS:")
            explanation = parts[0].strip()
            sub_concepts = [c.strip() for c in parts[1].split(",") if c.strip() and len(c.strip()) > 3][:5]
        else:
            explanation = raw
            sub_concepts = []
        return {"explanation": explanation, "sub_concepts": sub_concepts}
    else:
        return mock_explain(concept)
# ─────────────────────────────────────────────
# Mock responses (when no API key is available)
# ─────────────────────────────────────────────
MOCK_DATA = {
    "default_answer": {
        "answer": "This is a demonstration answer. In a real deployment with an API key, the system would generate a precise, contextual explanation for your question. The Recursive Understanding Engine is designed to break down complex topics into digestible layers, helping you build knowledge step by step.",
        "concepts": ["demonstration", "deployment", "contextual explanation", "Recursive Understanding", "knowledge layers", "digestible"]
    },
    "lime": {
        "answer": "LIME (Local Interpretable Model-agnostic Explanations) is an explainable AI technique that helps humans understand why a machine learning model made a specific prediction. It works by creating a simpler, interpretable model that approximates the complex model's behavior locally around a specific data point.",
        "concepts": ["Explainable AI", "interpretable model", "model-agnostic", "machine learning", "prediction", "data point", "approximation"]
    },
    "neural network": {
        "answer": "A neural network is a computational system inspired by the biological neural networks in the human brain. It consists of interconnected layers of nodes (neurons) that process information using weighted connections, learning patterns from training data through a process called backpropagation.",
        "concepts": ["computational system", "biological neural networks", "interconnected layers", "neurons", "weighted connections", "training data", "backpropagation"]
    }
}

MOCK_CONCEPTS = {
    "explainable ai": {"explanation": "Explainable AI (XAI) refers to methods and techniques that make AI decision-making transparent and understandable to humans. Instead of treating AI as a 'black box', XAI systems can describe why they made a particular decision in terms humans can understand.", "sub_concepts": ["black box", "transparency", "decision-making", "interpretability", "human understanding"]},
    "model-agnostic": {"explanation": "Model-agnostic means the method works independently of the specific machine learning algorithm used. Just like a universal remote can control any TV brand, a model-agnostic technique can explain or evaluate any type of model without needing to know its internal workings.", "sub_concepts": ["machine learning algorithm", "internal workings", "universal method", "abstraction", "flexibility"]},
    "machine learning": {"explanation": "Machine learning is a branch of AI where systems learn from data to improve their performance without being explicitly programmed. Instead of following fixed rules, the system finds patterns in examples and uses them to make decisions or predictions.", "sub_concepts": ["data patterns", "training", "algorithms", "predictions", "statistical models", "generalization"]},
    "backpropagation": {"explanation": "Backpropagation is the algorithm neural networks use to learn from mistakes. After making a prediction, it calculates how wrong it was (the error), then works backwards through the network to adjust each connection weight to reduce future errors.", "sub_concepts": ["gradient descent", "error calculation", "weight adjustment", "learning rate", "chain rule"]},
    "neurons": {"explanation": "In neural networks, neurons are simple mathematical units that receive one or more inputs, process them using a weighted sum, and produce an output signal. They are inspired by biological brain cells but are far simpler mathematical functions.", "sub_concepts": ["activation function", "weighted sum", "input signals", "biological brain", "mathematical function"]},
    "default": {"explanation": "This is a simplified explanation of the selected concept. In a real deployment with an API key, this would be a precise, beginner-friendly breakdown tailored to help you understand the term in context.", "sub_concepts": ["context", "understanding", "terminology", "knowledge building", "recursive exploration"]}
}

def mock_answer(question: str) -> dict:
    q = question.lower()
    for key in MOCK_DATA:
        if key in q:
            return MOCK_DATA[key]
    return MOCK_DATA["default_answer"]

def mock_explain(concept: str) -> dict:
    c = concept.lower()
    for key in MOCK_CONCEPTS:
        if key in c:
            return MOCK_CONCEPTS[key]
    return MOCK_CONCEPTS["default"]

# ─────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/ask", methods=["POST"])
def ask():
    data = request.get_json()
    question = data.get("question", "").strip()
    if not question:
        return jsonify({"error": "Question is required"}), 400
    result = generate_answer(question)
    return jsonify(result)

@app.route("/explain", methods=["POST"])
def explain():
    data = request.get_json()
    concept = data.get("concept", "").strip()
    context = data.get("context", "").strip()
    if not concept:
        return jsonify({"error": "Concept is required"}), 400
    result = explain_concept(concept, context)
    return jsonify(result)

@app.route("/api-status")
def api_status():
    return jsonify({"ai_enabled": USE_AI})

@app.route("/multi_explain", methods=["POST"])
def multi_explain():
    data = request.json
    concept = data["concept"]
    explanation_type = data["type"]
    
    prompt = f"""Explain "{concept}" as a {explanation_type} in 2-3 sentences.
- If type is "definition": give a clear, simple definition.
- If type is "analogy": give a real-world analogy to explain it.
- If type is "example": give a concrete, practical example.

Just give the explanation directly, no extra text."""

    try:
        result = call_claude(prompt)
    except Exception as e:
        result = f"Could not generate explanation: {str(e)}"

    return jsonify({"result": result})

if __name__ == "__main__":
    app.run(debug=True, port=5000)