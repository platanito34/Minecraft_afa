import { io } from 'socket.io-client'

let socket = null

export function getSocket() {
  if (!socket) {
    const token = localStorage.getItem('token')
    socket = io(import.meta.env.VITE_WS_URL || '', {
      auth: { token },
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 10,
    })
  }
  return socket
}

export function connectSocket() {
  const s = getSocket()
  if (!s.connected) s.connect()
  return s
}

export function disconnectSocket() {
  if (socket?.connected) {
    socket.disconnect()
    socket = null
  }
}
