import axios from "axios"

export const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL ||
    "https://desempenhocomercial.duckdns.org",
})

let pisCache: unknown[] | null = null
let pisCacheToken: string | null = null

export function getToken() {
  return localStorage.getItem("token")
}

export function setToken(token: string) {
  if (getToken() !== token) {
    limparPisCache()
  }
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

let redirecionandoParaLogin = false

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      clearToken()
      clearUser()

      if (
        typeof window !== "undefined" &&
        window.location.pathname !== "/login" &&
        !redirecionandoParaLogin
      ) {
        redirecionandoParaLogin = true
        window.location.replace("/login")
      }
    }

    return Promise.reject(error)
  }
)

export async function getPisCached() {
  const token = getToken()

  if (pisCache && pisCacheToken === token) {
    return pisCache
  }

  const response = await api.get("/api/pis", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  pisCache = Array.isArray(response.data) ? response.data : []
  pisCacheToken = token

  return pisCache
}

export function limparPisCache() {
  pisCache = null
  pisCacheToken = null
}
