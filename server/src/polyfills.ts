/**
 * 运行时兼容补丁。容器自带 Node 18，而 pdfjs-dist v6 使用了
 * Promise.withResolvers（Node 22+）。这里补一个最小 polyfill，
 * 让 PDF 文本提取在 Node 18 上也能工作。
 */
type PromiseWithResolvers = <T>() => {
  promise: Promise<T>
  resolve: (value: T | PromiseLike<T>) => void
  reject: (reason?: unknown) => void
}

const promiseCtor = Promise as unknown as { withResolvers?: PromiseWithResolvers }

if (typeof promiseCtor.withResolvers !== 'function') {
  promiseCtor.withResolvers = function withResolvers<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void
    let reject!: (reason?: unknown) => void
    const promise = new Promise<T>((res, rej) => {
      resolve = res
      reject = rej
    })
    return { promise, resolve, reject }
  }
}

export {}