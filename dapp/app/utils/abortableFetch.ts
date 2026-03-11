export function abortableFetch<T>(promise: Promise<T>, abortSignal: AbortSignal): Promise<T> {
    if (abortSignal.aborted) {
        return Promise.reject(new DOMException("Aborted", "AbortError"));
    }

    let onAbort: () => void;

    const abortPromise = new Promise<never>((_, reject) => {
        onAbort = () => reject(new DOMException("Aborted", "AbortError"));

        abortSignal.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError"))
        );
    });

    return Promise.race([promise, abortPromise]).finally(() => {
        if (onAbort) {
            abortSignal.removeEventListener("abort", onAbort);
        }
    });
}