const promiseCtor = Promise;
if (typeof promiseCtor.withResolvers !== 'function') {
    promiseCtor.withResolvers = function withResolvers() {
        let resolve;
        let reject;
        const promise = new Promise((res, rej) => {
            resolve = res;
            reject = rej;
        });
        return { promise, resolve, reject };
    };
}
export {};
