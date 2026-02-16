import { Link } from "react-router-dom";
import Container from "../components/Container";

export default function Dashboard() {
  return (
    <Container>
      <h1 className="text-2xl font-bold mb-6">Student Dashboard</h1>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="font-semibold mb-2">Cloud Computing</h2>
          <p className="text-sm text-gray-600 mb-4">
            Duration: 60 minutes
          </p>
          <Link
            to="/exam/1"
            className="inline-block text-primary font-medium hover:underline"
          >
            Start Exam →
          </Link>
        </div>
      </div>
    </Container>
  );
}
