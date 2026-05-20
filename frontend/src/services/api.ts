import axios from "axios"

export const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL ||
    "https://desempenhocomercial.duckdns.org",
})

export function getToken() {
  return localStorage.getItem("token")
}

export function setToken(token: string) {
  localStorage.setItem("token", token)
}

export function clearToken() {
  localStorage.removeItem("token")
}

export function getUser() {
  const raw = localStorage.getItem("usuario")

  return raw ? JSON.parse(raw) : null
}

export function setUser(user: unknown) {
  localStorage.setItem("usuario", JSON.stringify(user))
}

export function clearUser() {
  localStorage.removeItem("usuario")
}