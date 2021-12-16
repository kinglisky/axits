see: [谈谈 Axios 的 TypeScript 封装 ](https://juejin.cn/post/7042341684012646407/)

![截屏2021-11-06 上午12.32.28.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/c54ac6652a0e4f37806524edbc3754ba~tplv-k3u1fbpfcp-watermark.image?)

最近开始在新项目中使用 TypeScript 进行开发，经过一段时间磨合，算是过了痛苦期。然后有点皈依者狂热的意思，总想着能写出完美符合 TS 教条的代码，下面谈谈 TypeScript 场景下的 Axios 封装，给 Axios 加点类型支持。

# 确认配置

使用 Axios 进行请求工具封装时可以使用各种姿势，假设我们封装的是如下姿势的 api 工具：

```ts
api.getUser().then();
api.crateToken({ id: 1 }).then();
```

那实现上可以简单暴力的这样写：

```ts
type User = {
    id: number
    name: string
};

export const api = {
    getUser(id: number): Promise<User> {
        return axios.get('https://xxx.host/com/api/user', {
            params: { id },
            headers: {
                'x-header': 'xxx'
            }
        }).then(res => res.data);
    },

    crateToken(id: number) {
        return axios.post('https://xxx.host/com/api/token', {
            headers: {
                'x-header': 'xxx'
            },
            data: {
                id,
            },
        }).then(res => res.data);
    }
};

api.getUser(1).then(res => console.log(res)).catch(error => console.error(error));
```

如果是简单的几个 api 接口这样封装没什么问题，但接口一多管理就很困难了，这时候就需要有个配置文件来管理接口。配置里写什么东西呢？观察上面的上面的 api 我们可以简单总结下：

- 接口请求域名
- 接口请求头
- 接口名称
- 接口路径
- 接口请求方法

可以得出以下简单配置：

```ts
export const config = {
    baseURL: 'https://xxx.host.com',
    headers: {
        'x-headers': 'xxx',
    },
    apis: {
        getUser: {
            method: 'GET',
            path: '/api/user'
        },
        crateToken: {
            method: 'POST',
            path: '/api/token'
        },
    },
};
```

感觉还缺点东西，headers 配置不一定都是静态的，有些诸如 token 请求头一类的配置是需要从接口取的，那这里就再加个动态附加请求头的配置，考虑 token 一类的配置可能是异步获取的，统一使用 promise：

```ts
{
    ...other,
    headerHandlers: [
        () => Promise.resolve({ 'authorization': 'xxxx' }),
        () => Promise.resolve({ 'x-id': 'xxxx' }),
    ],
}
```

一般接口请求发生网络错误时需要进行错误提示或是鉴权，每个接口单独处理太过繁琐，统一在配置里加个捕获方法用于错误处理：

```ts
{
    ...other,
    errorHandler: (error) => {
        console.log(error.message);
    }
}
```

再来看一下 api 配置，不妨来扩充下，支持**路径参数**，也可以让一些特殊接口支持自己的 headers： 

```ts
{
    apis: {
        getUser: {
            method: 'GET',
            path: '/api/user'
        },
        crateToken: {
            method: 'POST',
            path: '/api/token'
        },
        download: {
            method: 'POST',
            path: '/api/download/:id',
            headers: { 'x-download': 'xxx' }
        }
    },
}
```

对大多数确定接口我们只需要知道其请求方法和路径即可，所以可以采取更为优雅写法：

```ts
{
    apis: {
        getUser: 'GET api/user',
        crateToken: 'POST api/token'
    },
}
```

或许你觉得这还不够，接口是自由的，那配置个函数：

```ts
{
    apis: {
        getRes: () => {
            // get cache data
            const res = JSON.parse(window.localStorage.getItem('cache') || 'null');
            return Promise.resolve(res);
        }
    },
}
```

整理一下我们可以得到一份这样的配置：

```ts
export const config = {
    baseURL: 'https://xxx.host.com',
    // 静态接口请求头
    headers: {
        'x-headers': 'xxx',
    },
    // 动态接口请求头
    headerHandlers: [
        () => Promise.resolve({ 'x-authorization': 'xxxx' }),
        () => Promise.resolve({ 'x-id': 'xxxx' }),
    ],
    // 错误处理函数
    errorHandler: (error) => {
        console.log(error.message);
    },
    // api 列表
    apis: {
        // 使用路径配置
        getUser: 'GET /api/user',
        // 使用配置文件
        download: {
            method: 'POST',
            // 支持参数占位符
            path: '/api/download/:id',
            // 特殊接口请求
            headers: { 'x-download': 'xxx' }
        },
        // 使用配置函数
        getRes: () => {
            // get cache data
            const res = JSON.parse(window.localStorage.getItem('cache') || 'null');
            return Promise.resolve(res);
        }
    },
};
```

这是一份很基本配置文件，在实际业务使用可以依据需要附加其他配置，如跨域、超时、接口缓存等，这里不做过多的讨论。有了配置文件后，接下来我们可以“加一点”类型支持~

# 类型支持

## 配置文件类型支持
既然有了配置文件，先来一步步描述它的类型，首先是 api 列表，api 支持三种配置形式：

- 路径
- 配置项
- 自定义函数

```ts
// 路径配置
type RequestPath = string;

// 选项配置
type RequestOptions = {
    path: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD' | 'OPTIONS' | 'CONNECT' | 'TRACE' | 'PATCH', 
    headers?: AxiosRequestHeaders;
};

// 自定义函数
type RequestFunction<P = Record<string, any> | void, R = any> = (
    params: P,
    ...args: any[]
) => Promise<R>;

type APIConfig = RequestPath | RequestOptions | RequestFunction;

type RequestConfig = {
    apis: Record<string, APIConfig>;
};
```

接着是 headers 处理函数和错误处理函数：

```ts
type HeaderHandler = (config?: AxiosRequestConfig) => Promise<AxiosRequestHeaders>;
type RequestErrorHandler = (error: AxiosError) => void;

type RequestConfig = {
    headerHandlers?: Array<HeaderHandler>;
    errorHandler?: RequestErrorHandler;
    apis: Record<string, APIConfig>;
};
```

补充下其他配置项：

```ts
type RequestConfig = {
    baseURL: string;
    headers?: AxiosRequestHeaders;
    headerHandlers?: Array<HeaderHandler>;
    errorHandler?: RequestErrorHandler;
    apis: Record<string, APIConfig>;
};
```

有了配置可以着手请求客户端的封装了，那是先写编码实现还是先写类型呢？建议是先写类型约束，虽然上面我们我们是从配置开始的，其实在设计配置时我们就可以先设计配置的类型描述，后面按接口的要求书写配置即可。

这也是 TS 开发带给我编码方式的改变。在纯 JavaScript 开发过程我可能不会太去关注功能接口约束，一般可能是写好功能才确定模块的接口，而使用 TS 过程会让我们更加关注接口约束，即先定义接口后实现功能。

## 接口约束

先来思考一个问题，在使用请求客户端时我们最关注的是什么东西呢？

```ts
api.getUser({ id: 'xxx' }).then(res => console.log(res.name));
```

看一眼上面的 api，可以总结下：

- 调用接口名
- 接口入参
- 接口返回值

写 JavaScript 使用 api 时我们需要经常翻出接口配置，在接口传参与返回时可能需要翻看接口文档才知道具体数据格式。

在 TS 中我们希望可以利用其强大类型推导能力，通过简单的配置实现 api **接口提示**与接口**入出参约束**，一方面也有替代接口文档的作用，效果如下：

![0.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/11385ef9ba924e729108326b41b0e067~tplv-k3u1fbpfcp-watermark.image?)

![1.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/684927e19e3e438c927b9f30a108fa2f~tplv-k3u1fbpfcp-watermark.image?)

![WechatIMG1094.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/1cb304a19ef948e5a9b56d3cdbdde639~tplv-k3u1fbpfcp-watermark.image?)

需要实现接口名、入参与出参提示，自然需要将他们的配置描述出来。

```ts
type APISchema = Record<string, {
    request: Record<string, any> | void;
    response: Record<string, any> | any;
}>;

interface TestAPISchema extends APISchema {
    getUser: {
        request: {
            id: number;
        };
        response: {
            avatar: string;
            id: number;
            name: string;
        };
    };

    createUser: {
        request: {
            avatar: string;
            name: string;
        };
        response: {
            avatar: string;
            id: number;
            name: string;
        };
    },
}
```

要数全了，看一下之前的 api 配置：

```ts
type RequestConfig = { apis: Record<string, APIConfig>; };
```

我们使用 `Record<string, APIConfig>` 来描述 api 配置，正确 ✅ 但不够准确，有了 `APISchema` 配置信息我们可以更加准确的描述配置文件了。

```ts
type CreateRequestConfig<T extends APISchema> = {
    baseURL: string;
    headers?: AxiosRequestHeaders;
    headerHandlers?: Array<HeaderHandler>;
    errorHandler?: RequestErrorHandler;
    apis: {
        [K in keyof T]: APIConfig;
    };
};

// 使用 schema 创建配置
const config: CreateRequestConfig<TestAPISchema> = { xxx }
```

![3.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/01db565d10d74ed9bd6d44718cc5c3e8~tplv-k3u1fbpfcp-watermark.image?)

在准确描述配置文件的同时也可以规范配置文件。

接下来就是描述 api 客户端了，与描述配置文件一样基于 `APISchema` 创建客户端类型约束。

```ts
type RequestFunction<P = Record<string, any> | void, R = any> = (
    params: P,
    ...args: any[]
) => Promise<R>;

type CreateRequestClient<T extends APISchema> = {
    [K in keyof T]: RequestFunction<T[K]['request'], AxiosResponse<T[K]['response']>>;
};

const client: CreateRequestClient<TestAPISchema> = { xxx }
```
![image.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/f0bb2472f88c4336811a5975f69e2ae8~tplv-k3u1fbpfcp-watermark.image?)

![image.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/eb0adeae5abe463ab477e03e4d1d6661~tplv-k3u1fbpfcp-watermark.image?)

![image.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/4de5ab7ddbce4853882ab3f3baa077ad~tplv-k3u1fbpfcp-watermark.image?)

自此我们已经完成了 `APISchema` 生成配置文件与客户端接口的操作，下面就是具体客户端封装了。


# 客户端封装

封装的代码比较简单，这里直接贴实现了。

源码在：https://github.com/kinglisky/axits

```ts
import axios, { AxiosInstance, AxiosRequestHeaders, AxiosError } from 'axios';
import {
    APISchema,
    RequestPath,
    RequestFunction,
    RequestOptions,
    CreateRequestConfig,
    CreateRequestClient,
} from './type';

const MATCH_METHOD = /^(GET|POST|PUT|DELETE|HEAD|OPTIONS|CONNECT|TRACE|PATCH)\s+/;
const MATCH_PATH_PARAMS = /:(\w+)/g;
const USE_DATA_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

function attachAPI<T extends APISchema>(
    client: AxiosInstance,
    apis: CreateRequestConfig<T>['apis'],
): CreateRequestClient<T> {
    const hostApi: CreateRequestClient<T> = Object.create(null);
    for (const apiName in apis) {
        const apiConfig = apis[apiName];
        // 配置为一个函数
        if (typeof apiConfig === 'function') {
            hostApi[apiName] = apiConfig as RequestFunction;
            continue;
        }
        let apiOptions = {};
        let apiPath = apiConfig as RequestPath;
        // 配置为一个对象
        if (typeof apiConfig === 'object') {
            const { path, ...rest } = apiConfig as RequestOptions;
            apiPath = path;
            apiOptions = rest;
        }
        hostApi[apiName] = (params, options) => {
            const _params = { ...(params || {}) };
            // 匹配路径中请求方法，如：'POST /api/test'
            const [prefix, method] = apiPath.match(MATCH_METHOD) || ['GET ', 'GET'];
            // 剔除掉 ”POST “ 前缀
            let url = apiPath.replace(prefix, '');
            // 匹配路径中的参数占位符， 如 '/api/:user_id/:res_id'
            const matchParams = apiPath.match(MATCH_PATH_PARAMS);
            if (matchParams) {
                matchParams.forEach((match) => {
                    const key = match.replace(':', '');
                    if (Reflect.has(_params, key)) {
                        url = url.replace(match, Reflect.get(_params, key));
                        Reflect.deleteProperty(_params, key);
                    }
                });
            }
            const requestParams = USE_DATA_METHODS.includes(method)
                ? { data: _params }
                : { params: _params };
            return client.request({
                url,
                method: method.toLowerCase(),
                ...requestParams,
                ...apiOptions,
                ...options,
            });
        };
    }
    return hostApi;
}

// 创建请求客户端
export function createRequestClient<T extends APISchema>(requestConfig: CreateRequestConfig<T>): CreateRequestClient<T> {
    const client = axios.create({
        baseURL: requestConfig.baseURL,
        headers: requestConfig.headers,
    });

    // 附加各业务请求头
    client.interceptors.request.use((config) => {
        const headerHandlers = (requestConfig.headerHandlers || []).map((handler) => {
            return handler(config)
                .then((mixHeaders: AxiosRequestHeaders) => {
                    Object.assign(config.headers, mixHeaders);
                })
                .catch();
        });
        return Promise.all(headerHandlers).then(() => config);
    });

    // 拦截请求
    client.interceptors.response.use(
        (res) => res,
        (error: AxiosError) => {
            const requestError = requestConfig.errorHandler
                ? requestConfig.errorHandler(error)
                : error;
            return Promise.reject(requestError);
        },
    );

    return attachAPI<T>(client, requestConfig.apis);
}
```

使用：

```ts
import { APISchema } from './type';
import { createRequestClient } from './request';

interface TestAPISchema extends APISchema {
    getUser: {
        request: {
            id: number;
        };
        response: {
            avatar: string;
            id: number;
            name: string;
        };
    };

    createUser: {
        request: {
            avatar: string;
            name: string;
        };
        response: {
            avatar: string;
            id: number;
            name: string;
        };
    },
}

const api = createRequestClient<TestAPISchema>({
    baseURL: '',
    apis: {
        getUser: 'GET api/user/:id',
        createUser: 'POST api/user',
    }
});
```

over~

