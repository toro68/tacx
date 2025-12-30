import { DataView } from './data-views/base.js';

import './data-views/misc.js';
import { TimerTime, IntervalTime } from './data-views/time.js';
import { SpeedValue, DistanceValue } from './data-views/speed.js';
import { CadenceValue, CadenceLapValue, CadenceAvgValue, CadenceTarget, CadenceGroup } from './data-views/cadence.js';
import { HeartRateValue, HeartRateLapValue, HeartRateAvgValue } from './data-views/heart.js';
import { SmO2Value, THbValue } from './data-views/moxy.js';
import { WorkoutName, PowerTarget } from './data-views/workout.js';
import './data-views/z-stack.js';
import { SlopeTarget } from './data-views/slope.js';
import './data-views/controls.js';
import { PowerValue, PowerAvg } from './data-views/power.js';
import './data-views/laps.js';
import { InstantPowerGraph } from './data-views/graph.js';
import { SwitchGroup, DataTileSwitchGroup } from './data-views/switches.js';
import { NavigationStack } from './data-views/navigation-stack.js';
import { ViewAction, BatteryLevel } from './data-views/view-actions.js';
import './data-views/oauth.js';
import './data-views/modal-error.js';
import { MeasurementUnit, ThemeValue, MeasurementValue } from './data-views/measurement.js';
import './data-views/auto.js';
import './data-views/theme.js';
import { DockModeBtn } from './data-views/dock.js';
import './data-views/sound.js';
import './data-views/compatibility.js';

export {
    DataView,

    TimerTime,
    IntervalTime,
    CadenceValue,
    CadenceLapValue,
    CadenceAvgValue,
    CadenceTarget,
    CadenceGroup,
    SpeedValue,
    DistanceValue,
    HeartRateValue,
    HeartRateLapValue,
    HeartRateAvgValue,
    SmO2Value,
    THbValue,
    PowerAvg,
    PowerValue,
    MeasurementUnit,
    ThemeValue,
    MeasurementValue,

    SlopeTarget,
    PowerTarget,

    WorkoutName,

    InstantPowerGraph,

    SwitchGroup,
    DataTileSwitchGroup,

    DockModeBtn,

    NavigationStack,
    ViewAction,
    BatteryLevel,
};

