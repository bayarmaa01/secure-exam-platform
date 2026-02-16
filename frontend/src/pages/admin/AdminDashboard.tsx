import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
} from "recharts";

const COLORS = ["#22c55e", "#ef4444"];

// ✅ Define data here
const examStats = [
  { name: "Pass", value: 75 },
  { name: "Fail", value: 25 },
];

const monthlyAttempts = [
  { month: "Jan", attempts: 40 },
  { month: "Feb", attempts: 55 },
  { month: "Mar", attempts: 70 },
  { month: "Apr", attempts: 60 },
];

export default function AdminDashboard() {
  return (
    <div className="p-6 space-y-8">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* PASS / FAIL PIE */}
        <div className="bg-white p-4 rounded shadow">
          <h2 className="font-semibold mb-4">Exam Results</h2>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={examStats}
                dataKey="value"
                nameKey="name"
                outerRadius={80}
              >
                {examStats.map((_, index) => (
                  <Cell key={index} fill={COLORS[index]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* MONTHLY ATTEMPTS */}
        <div className="bg-white p-4 rounded shadow">
          <h2 className="font-semibold mb-4">Monthly Exam Attempts</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={monthlyAttempts}>
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="attempts" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
