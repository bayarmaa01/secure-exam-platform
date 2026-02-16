import { useEffect, useState } from "react";

export default function ExamTimer({ duration }: { duration: number }) {
  const [time, setTime] = useState(duration);

  useEffect(() => {
    const interval = setInterval(() => {
      setTime((t) => t - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="font-bold text-red-600">
      Time Left: {Math.max(time, 0)} sec
    </div>
  );
}
