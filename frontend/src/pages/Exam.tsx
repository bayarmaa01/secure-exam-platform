import ExamTimer from "../components/ExamTimer";
import WebcamStatus from "../components/WebcamStatus";
import FullscreenGuard from "../components/FullscreenGuard";
import Container from "../components/Container";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../services/api";

export default function Exam() {
  const navigate = useNavigate();
  const userId = localStorage.getItem("user_id") || "student123";

  const handleSubmit = async () => {
    try {
      // TODO: collect answers from your form
      const answers = [{ questionId: 1, answer: "Kubernetes explanation" }];

      await apiRequest("/exams/submit", {
        method: "POST",
        body: JSON.stringify({ examId: "exam123", answers }),
      });

      alert("Exam submitted successfully");
      navigate("/exam-complete");
    } catch (err: any) {
      alert("Submission failed: " + err.message);
    }
  };

  const onFullscreenExit = () => {
    alert("Fullscreen exited! Auto-submitting exam.");
    handleSubmit();
  };

  return (
    <Container>
      <FullscreenGuard onExit={onFullscreenExit} />
      <div className="flex justify-between items-center mb-6">
        <ExamTimer duration={600} />
        <WebcamStatus userId={userId} onCheatingDetected={handleSubmit} />
      </div>

      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <p className="font-semibold mb-2">Q1. Explain Kubernetes architecture.</p>
        <textarea
          rows={6}
          className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <button
        onClick={handleSubmit}
        className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700"
      >
        Submit Exam
      </button>
    </Container>
  );
}
