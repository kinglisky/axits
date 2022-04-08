import { AxiosRequestHeaders, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

/** 去除可索引签名 */
type RemoveIndexSignature<Obj extends Record<string, any>> = {
    [Key in keyof Obj as Key extends `${infer Str}` ? Str : never]: Obj[Key];
};

// 路径配置
export type RequestPath = `${Uppercase<RequestOptions['method']>} ${string}`;

// 选项配置
export type RequestOptions = {
    path: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD' | 'OPTIONS' | 'CONNECT' | 'TRACE' | 'PATCH',
    headers?: AxiosRequestHeaders;
};

// 自定义函数
export type RequestFunction<P = Record<string, any> | void, R = any> = (
    params: P,
    ...args: any[]
) => Promise<R>;

export type APIConfig = RequestPath | RequestOptions | RequestFunction;

export type HeaderHandler = (config?: AxiosRequestConfig) => Promise<AxiosRequestHeaders>;
export type RequestErrorHandler = (error: AxiosError) => void;

export type APISchema = Record<string, {
    request: Record<string, any> | void;
    response: Record<string, any> | any;
}>;

export type CreateRequestConfig<T extends APISchema> = {
    baseURL: string;
    headers?: AxiosRequestHeaders;
    headerHandlers?: Array<HeaderHandler>;
    errorHandler?: RequestErrorHandler;
    apis: {
        [K in keyof RemoveIndexSignature<T>]: APIConfig;
    };
};

// 创建请求客户端的类型约束
export type CreateRequestClient<T extends APISchema> = {
    [K in keyof RemoveIndexSignature<T>]: RequestFunction<
        RemoveIndexSignature<T>[K]['request'],
        AxiosResponse<RemoveIndexSignature<T>[K]['response']>
    >;
};
