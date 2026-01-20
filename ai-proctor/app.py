from flask import Flask, request
app = Flask(__name__)

@app.route("/monitor", methods=["POST"])
def monitor():
    # Dummy AI logic
    return {"cheating_score": 0.2}

app.run(host="0.0.0.0", port=6000)
