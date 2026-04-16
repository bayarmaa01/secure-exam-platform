import { Server as SocketIOServer } from 'socket.io'

let ioInstance: SocketIOServer | null = null

export const setIO = (io: SocketIOServer) => {
  ioInstance = io
}

export const getIO = (): SocketIOServer => {
  if (!ioInstance) {
    throw new Error('Socket.IO not initialized. Make sure to call setIO() in main index.ts')
  }
  return ioInstance
}

export const emitToUser = (userId: string, event: string, data: any) => {
  const io = getIO()
  io.emit(`user_${userId}`, event, data)
}

export const emitToExamRoom = (examId: string, event: string, data: any) => {
  const io = getIO()
  io.emit(`exam_${examId}`, event, data)
}

export const broadcastToTeachers = (event: string, data: any) => {
  const io = getIO()
  io.emit('teachers', event, data)
}

export const broadcastToStudents = (event: string, data: any) => {
  const io = getIO()
  io.emit('students', event, data)
}

export const broadcastToAll = (event: string, data: any) => {
  const io = getIO()
  io.emit(event, data)
}
