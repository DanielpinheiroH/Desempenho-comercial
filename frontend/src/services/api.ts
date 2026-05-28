import axios from "axios"

export const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL ||
    "https://desempenhocomercial.duckdns.org",
})

let pisCache: unknown[] | null = null

export function getToken() {
  return localStorage.getItem("token")
}

export function setToken(token: string) {
  localStorage.setItem("token", token)
}

export function clearToken() {
  localStorage.removeItem("token")
  limparPisCache()
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
  limparPisCache()
}

export async function getPisCached() {
  if (pisCache) {
    return pisCache
  }

  const token = getToken()

  const response = await api.get("/api/pis", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  pisCache = Array.isArray(response.data) ? response.data : []

  return pisCache
}

export function limparPisCache() {
  pisCache = null
}