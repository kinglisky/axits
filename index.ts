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
