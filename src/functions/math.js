function avg(xs, prop = false) {
    if(prop !== false) {
        return xs.reduce((acc, v, i) => acc + (v[prop] - acc) / (i + 1), 0);
    } else {
        return xs.reduce((acc, v, i) => acc + (v - acc) / (i + 1), 0);
    }
}

function mavg(value_c, value_p, count_c, count_p = count_c - 1) {
    return (value_c + ((count_p) * value_p)) / count_c;
}

function max(xs, prop = false) {
    if(prop !== false) {
        return xs.reduce((acc, v) => v[prop] > acc ? v[prop] : acc, 0);
    } else {
        return Math.max(...xs);
    }
}

function sum(xs, path = false) {
    if(path !== false) {
        return xs.reduce((acc, v) => acc + v[path], 0);
    } else {
        return xs.reduce((acc, v) => acc + v, 0);
    }
}

function rand(min = 0, max = 10) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

function clamp(lower, upper, value) {
    if(value >= upper) {
        return upper;
    } else if(value < lower) {
        return lower;
    } else {
        return value;
    }
}

export { avg, mavg, max, sum, rand, clamp };

