async function delay(ms) {
    return await new Promise((res) => setTimeout(res, ms));
}

async function wait(ms) {
    return await new Promise((res) => setTimeout(res, ms));
}

export { delay, wait };

