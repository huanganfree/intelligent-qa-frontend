import request from "@/axios/axios"


const prefix = import.meta.env.VITE_API_KB_URL

export async function fetchUploadKB(data: FormData) {
    return request.post<string>({ url: `${prefix}/upload`, data })
}

export async function fetchKBAnswer(data: FormData) {
    return request.post<string>({ url: `${prefix}/search`, data })
}

export async function fetchKBChat(data: FormData) {
    return request.post<string>({ url: `${prefix}/chat`, data })
}