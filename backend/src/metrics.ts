import client from 'prom-client';

// 🔥 PROMETHEUS METRICS FOR AI PROCTORING
const register = new client.Registry();

// Add default metrics (CPU, memory, etc.)
client.collectDefaultMetrics({ register });

// Custom metrics for AI proctoring
const suspiciousEventsTotal = new client.Counter({
  name: 'suspicious_events_total',
  help: 'Total number of suspicious events detected',
  labelNames: ['event_type', 'exam_id', 'student_id'],
  registers: [register]
});

const faceNotDetected = new client.Counter({
  name: 'face_not_detected_total',
  help: 'Total number of times face was not detected',
  labelNames: ['exam_id', 'student_id'],
  registers: [register]
});

const multipleFacesDetected = new client.Counter({
  name: 'multiple_faces_detected_total',
  help: 'Total number of times multiple faces were detected',
  labelNames: ['exam_id', 'student_id'],
  registers: [register]
});

const tabSwitchCount = new client.Counter({
  name: 'tab_switch_count_total',
  help: 'Total number of tab switches detected',
  labelNames: ['exam_id', 'student_id'],
  registers: [register]
});

const examSessionsActive = new client.Gauge({
  name: 'exam_sessions_active',
  help: 'Number of currently active exam sessions',
  registers: [register]
});

const aiProcessingTime = new client.Histogram({
  name: 'ai_processing_duration_seconds',
  help: 'Time spent processing AI proctoring data',
  labelNames: ['operation'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register]
});

// Export metrics and register
export {
  register,
  suspiciousEventsTotal,
  faceNotDetected,
  multipleFacesDetected,
  tabSwitchCount,
  examSessionsActive,
  aiProcessingTime
};
