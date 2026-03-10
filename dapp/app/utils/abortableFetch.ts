export function abortableFetch<T>(promise: Promise<T>, abortSignal: AbortSignal): Promise<T> {
    const abortPromise = new Promise<never>((_, reject) => {
        abortSignal.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError"))
        );
    });

    return Promise.race([promise, abortPromise]);
}