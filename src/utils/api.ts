import axios, { AxiosResponse, InternalAxiosRequestConfig } from 'axios';

interface ApiResponse<T> {
  data: T;
  message: string;
  status: number;
}

interface ApiErrorResponse {
  message: string;
  status: number;
}

const request = axios.create({
	baseURL: 'https://api.hyperindex.trade/',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
request.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token && config.headers) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
request.interceptors.response.use(
  (response: AxiosResponse<ApiResponse<any>>) => {
    if (response.status === 200) {
      return response;
    }
    return Promise.reject(new Error('error'));
  },
  (error) => {
    const errorResponse: ApiErrorResponse = {
      message: error.response?.data?.message || 'An error occurred',
      status: error.response?.status || 500,
    };

    // 统一处理常见 HTTP 错误
    if (errorResponse.status === 401) {
      console.error('Unauthorized, please log in again.');
    } else if (errorResponse.status === 500) {
      console.error('Internal server error.');
    }

    return Promise.reject(errorResponse);
  }
);

export default request;
