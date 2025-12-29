import { time } from './format.js';

function Print() {
    const env =
        (typeof process !== 'undefined' && process?.env?.NODE_ENV) ?
            process.env.NODE_ENV :
            'development';

    const printLog = env === 'development';
    const printWarn = env !== 'test';

    function log(msg) {
        if(printLog) {
            console.log(`[${time()}] ${msg}`);
        }
    }

    function warn(msg) {
        if(printWarn) {
            console.warn(`[${time()}] ${msg}`);
        }
    }

    function callKarenFromHR() {
        console.warn(`calling Karen from HR ...`);
    }

    function makeCoffee() {
        console.warn(`making coffee ...`);
        console.warn(`
      )  (
     (   ) )
      ) ( (
    _______)_
 .-'---------|
( C|=========|
 '-./_/_/_/_/|
   '_________'
    '-------'
`);
    }

    return {
        log,
        warn,
        makeCoffee,
        callKarenFromHR,
    };
}

const print = Print();

export { Print, print };

