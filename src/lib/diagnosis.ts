// "Fix a problem": a step-by-step diagnosis that works with no AI and no
// account. Pick what's happening, answer a few tap-to-answer questions, and
// each answer adds evidence for the likely causes. The top causes come back
// with how urgent they are, a rough UK price and something to check yourself.
//
// It's a guide, not a guarantee: the result page always says so, offers the
// AI follow-up when it's switched on, and hands over to the community or a
// mechanic when it isn't sure.

export type Urgency = "stop" | "soon" | "monitor";

export type Cause = {
  id: string;
  name: string;
  /** ISSUE_SYSTEMS id, so community posts and fixes line up. */
  system: string;
  urgency: Urgency;
  /** Rough UK garage price, parts and labour. */
  cost: string;
  explain: string;
  check: string;
  /** Starting weight before any answers (how common it is). */
  prior?: number;
};

export type Option = {
  id: string;
  label: string;
  emoji?: string;
  /** Evidence added to each cause when picked. */
  weights?: Record<string, number>;
  /** Questions to skip after this answer. */
  skip?: string[];
  /** This answer alone means stop driving. */
  danger?: string;
};

export type Question = { id: string; text: string; help?: string; options: Option[] };

export type Area = {
  id: string;
  label: string;
  emoji: string;
  blurb: string;
  system: string;
  causes: Cause[];
  questions: Question[];
};

export const URGENCY_LABEL: Record<Urgency, { title: string; tone: string }> = {
  stop: { title: "Stop driving — get it checked first", tone: "danger" },
  soon: { title: "Book it in soon", tone: "warn" },
  monitor: { title: "Keep an eye on it", tone: "ok" },
};

const NOT_SURE: Option = { id: "not_sure", label: "Not sure", emoji: "🤷" };

export const AREAS: Area[] = [
  {
    id: "leak",
    label: "Leak or puddle",
    emoji: "💧",
    blurb: "Drips or a puddle under the car",
    system: "engine",
    causes: [
      {
        id: "coolant_leak",
        name: "Coolant leak (hose, radiator or water pump)",
        system: "cooling",
        urgency: "soon",
        cost: "£80–£450",
        explain:
          "Coolant keeps the engine from overheating. A leak lets the level drop, which can lead to overheating.",
        check:
          "With the engine cold, look at the coolant tank level. Look for crusty green, pink or orange marks on hoses and the radiator.",
        prior: 2,
      },
      {
        id: "oil_leak",
        name: "Engine oil leak (gasket or seal)",
        system: "engine",
        urgency: "soon",
        cost: "£60–£600",
        explain:
          "Usually a tired rocker cover gasket, sump gasket or oil seal. Small leaks are common on older cars; big ones can starve the engine.",
        check:
          "Check the dipstick. Look for wet, dark, oily patches around the top and bottom of the engine.",
        prior: 2,
      },
      {
        id: "ac_water",
        name: "Air-con condensation (normal)",
        system: "other",
        urgency: "monitor",
        cost: "£0",
        explain:
          "Clear water dripping near the front footwell after using air-con or on a warm day is normal.",
        check:
          "Touch it: clear, no smell, not slippery = water. It should dry up after the car's been parked.",
        prior: 2,
      },
      {
        id: "brake_fluid",
        name: "Brake fluid leak",
        system: "brakes",
        urgency: "stop",
        cost: "£60–£250",
        explain: "Brake fluid leaks can make the brakes fail. Don't drive it.",
        check:
          "Look at the brake fluid reservoir under the bonnet. If it's below MIN, or the pedal feels soft, don't drive.",
        prior: 0.5,
      },
      {
        id: "trans_fluid",
        name: "Gearbox or power-steering fluid leak",
        system: "gearbox",
        urgency: "soon",
        cost: "£100–£500",
        explain:
          "Red or brown oily fluid from the middle or front of the car is often gearbox or power-steering fluid.",
        check:
          "Check the power-steering reservoir if your car has one. Heavy steering or whining on full lock is a clue.",
        prior: 0.8,
      },
      {
        id: "screenwash",
        name: "Screenwash leak",
        system: "other",
        urgency: "monitor",
        cost: "£20–£80",
        explain: "A split washer bottle or pipe. Annoying, not dangerous.",
        check: "Fill the washer bottle and see if it empties quickly.",
        prior: 0.8,
      },
      {
        id: "fuel_leak",
        name: "Fuel leak",
        system: "fuel",
        urgency: "stop",
        cost: "£80–£400",
        explain: "A fuel leak is a fire risk. Don't start or drive the car.",
        check:
          "A strong smell of petrol or diesel around the car is enough. Don't smoke near it; call a mechanic or breakdown cover.",
        prior: 0.4,
      },
      {
        id: "exhaust_water",
        name: "Water from the exhaust (normal)",
        system: "exhaust",
        urgency: "monitor",
        cost: "£0",
        explain:
          "Drips from the exhaust tailpipe on short trips or cold days are normal condensation.",
        check: "Clear water from the tailpipe that stops once the car's warm.",
        prior: 0.8,
      },
    ],
    questions: [
      {
        id: "colour",
        text: "What colour is it?",
        help: "Dab it with kitchen roll to see the colour.",
        options: [
          {
            id: "clear_water",
            label: "Clear like water, no smell",
            emoji: "💧",
            weights: { ac_water: 5, exhaust_water: 3, screenwash: 1 },
          },
          {
            id: "green_pink",
            label: "Green, pink, orange or yellow, sweet smell",
            emoji: "🟢",
            weights: { coolant_leak: 6 },
          },
          {
            id: "brown_black",
            label: "Brown or black and oily",
            emoji: "🟤",
            weights: { oil_leak: 6, trans_fluid: 1 },
          },
          {
            id: "red",
            label: "Red or reddish and oily",
            emoji: "🔴",
            weights: { trans_fluid: 5, coolant_leak: 1 },
          },
          {
            id: "blue",
            label: "Blue and watery",
            emoji: "🔵",
            weights: { screenwash: 6, coolant_leak: 1 },
          },
          {
            id: "slippery_clear",
            label: "Clear or yellow-brown, slippery, near a wheel",
            emoji: "⚠️",
            weights: { brake_fluid: 7 },
            danger: "Brake fluid near a wheel can mean the brakes could fail.",
          },
          {
            id: "smells_fuel",
            label: "Smells of petrol or diesel",
            emoji: "⛽",
            weights: { fuel_leak: 8 },
            danger: "A fuel leak is a fire risk.",
          },
          NOT_SURE,
        ],
      },
      {
        id: "where",
        text: "Where is the puddle?",
        options: [
          {
            id: "front_middle",
            label: "Under the engine (front, middle)",
            weights: { oil_leak: 2, coolant_leak: 2 },
          },
          {
            id: "front_passenger",
            label: "Front, near the passenger footwell",
            weights: { ac_water: 3 },
          },
          { id: "near_wheel", label: "Near one wheel", weights: { brake_fluid: 3 } },
          { id: "middle", label: "Middle of the car", weights: { trans_fluid: 2, fuel_leak: 1 } },
          {
            id: "back",
            label: "At the back / under the exhaust",
            weights: { exhaust_water: 3, fuel_leak: 1 },
          },
          NOT_SURE,
        ],
      },
      {
        id: "when",
        text: "When do you notice it?",
        options: [
          {
            id: "after_ac",
            label: "After using air-con or on a hot day",
            weights: { ac_water: 4 },
          },
          {
            id: "always",
            label: "Every time it's parked",
            weights: { oil_leak: 1, coolant_leak: 1 },
          },
          {
            id: "level_dropping",
            label: "A fluid level keeps dropping",
            weights: { coolant_leak: 2, oil_leak: 2, brake_fluid: 2 },
          },
          {
            id: "short_trips",
            label: "After short trips or cold mornings",
            weights: { exhaust_water: 3 },
          },
          NOT_SURE,
        ],
      },
    ],
  },
  {
    id: "warning_light",
    label: "Warning light",
    emoji: "🚨",
    blurb: "Something lit up on the dashboard",
    system: "electrical",
    causes: [
      {
        id: "misfire",
        name: "Engine misfire (coil pack or spark plug)",
        system: "engine",
        urgency: "stop",
        cost: "£80–£300",
        explain:
          "A flashing engine light usually means a misfire, which can damage the catalytic converter if you keep driving.",
        check:
          "Does the engine shake at idle or feel down on power? Ease off and get it read with a code reader.",
        prior: 1,
      },
      {
        id: "engine_sensor",
        name: "Engine sensor or emissions fault",
        system: "engine",
        urgency: "soon",
        cost: "£60–£300",
        explain:
          "A steady engine light is often a sensor (oxygen, MAF, EGR). Usually safe to drive gently to a garage.",
        check:
          "Get the fault code read; many garages and parts shops do it cheaply. A loose fuel cap can also trigger it.",
        prior: 2,
      },
      {
        id: "oil_pressure",
        name: "Low oil pressure",
        system: "engine",
        urgency: "stop",
        cost: "£0–£1,500",
        explain:
          "The red oil-can light means the engine isn't getting enough oil pressure. Driving on can wreck the engine in minutes.",
        check:
          "Stop safely, switch off, wait 5 minutes, check the dipstick. Don't drive if the light stays on.",
        prior: 0.6,
      },
      {
        id: "charging",
        name: "Charging fault (alternator or belt)",
        system: "electrical",
        urgency: "soon",
        cost: "£150–£450",
        explain:
          "The battery light means the battery isn't being charged. The car will run until the battery is flat, then stop.",
        check:
          "Turn off non-essentials and head to a garage. A squeal from the belt or dimming lights are clues.",
        prior: 1,
      },
      {
        id: "overheat_light",
        name: "Engine overheating",
        system: "cooling",
        urgency: "stop",
        cost: "£50–£1,500",
        explain:
          "A red temperature light means the engine is too hot. Keep driving and it can blow the head gasket.",
        check:
          "Pull over and switch off. Don't open the coolant cap when hot. Check the level once cold.",
        prior: 0.6,
      },
      {
        id: "brake_warning",
        name: "Brake fluid low or pads worn",
        system: "brakes",
        urgency: "soon",
        cost: "£60–£250",
        explain:
          "The red brake light can mean low brake fluid (serious) or the handbrake is on. An amber pad light means pads are worn.",
        check:
          "Check the handbrake's fully off and the brake fluid level. If the pedal feels soft, don't drive.",
        prior: 0.8,
      },
      {
        id: "abs",
        name: "ABS sensor fault",
        system: "brakes",
        urgency: "soon",
        cost: "£60–£200",
        explain: "Normal brakes still work, but ABS (anti-lock) is off. It's an MOT fail.",
        check: "Usually a wheel speed sensor or its wiring. Get the code read.",
        prior: 0.8,
      },
      {
        id: "airbag",
        name: "Airbag system fault",
        system: "electrical",
        urgency: "soon",
        cost: "£50–£300",
        explain: "The airbags may not go off in a crash. It's an MOT fail.",
        check: "Often a seat connector under the front seat. Get it read by a garage.",
        prior: 0.6,
      },
      {
        id: "tyre_pressure",
        name: "Low tyre pressure",
        system: "tyres_wheels",
        urgency: "soon",
        cost: "£0–£30",
        explain: "One or more tyres are low, often after a cold snap or a slow puncture.",
        check:
          "Check pressures (inside the fuel flap or door shut) at a garage air machine, then reset the warning.",
        prior: 1,
      },
      {
        id: "dpf",
        name: "Blocked diesel particulate filter (DPF)",
        system: "exhaust",
        urgency: "soon",
        cost: "£0–£1,000",
        explain: "Diesels doing lots of short trips clog the DPF.",
        check:
          "A 20-minute motorway drive at steady revs often clears it. If it doesn't, see a garage soon.",
        prior: 0.6,
      },
      {
        id: "glow_plug",
        name: "Glow plug or engine management fault (diesel)",
        system: "engine",
        urgency: "soon",
        cost: "£100–£400",
        explain: "A flashing coil light on a diesel usually means an engine management fault.",
        check: "Get the code read. It might go into limp mode (low power).",
        prior: 0.4,
      },
    ],
    questions: [
      {
        id: "which",
        text: "Which light is on?",
        options: [
          {
            id: "engine",
            label: "Engine outline (amber)",
            emoji: "🟧",
            weights: { engine_sensor: 4, misfire: 2, dpf: 1 },
          },
          {
            id: "oil",
            label: "Oil can (red)",
            emoji: "🛢️",
            weights: { oil_pressure: 8 },
            danger: "The red oil light can mean the engine is about to be damaged.",
          },
          { id: "battery", label: "Battery (red)", emoji: "🔋", weights: { charging: 8 } },
          {
            id: "temp",
            label: "Thermometer (red)",
            emoji: "🌡️",
            weights: { overheat_light: 8 },
            danger: "Overheating can wreck the engine.",
          },
          {
            id: "brake",
            label: "Brake ( ! ) or brake pads",
            emoji: "🛑",
            weights: { brake_warning: 7 },
          },
          { id: "abs", label: "ABS", weights: { abs: 8 } },
          { id: "airbag", label: "Airbag / seatbelt person", weights: { airbag: 8 } },
          { id: "tyre", label: "Tyre with ( ! )", weights: { tyre_pressure: 8 } },
          { id: "dpf", label: "Box with dots (DPF)", weights: { dpf: 8 } },
          { id: "coil", label: "Coil / spring (diesel)", weights: { glow_plug: 7 } },
          NOT_SURE,
        ],
      },
      {
        id: "flashing",
        text: "Is it flashing or steady?",
        options: [
          { id: "flashing", label: "Flashing", weights: { misfire: 5, glow_plug: 2 } },
          { id: "steady", label: "Steady", weights: { engine_sensor: 2 } },
          NOT_SURE,
        ],
      },
      {
        id: "driving",
        text: "How does the car drive?",
        options: [
          {
            id: "normal",
            label: "Seems normal",
            weights: { engine_sensor: 2, tyre_pressure: 1, abs: 1, airbag: 1 },
          },
          {
            id: "no_power",
            label: "Down on power / limp mode",
            weights: { dpf: 3, glow_plug: 2, misfire: 1 },
          },
          { id: "shaking", label: "Shaking or running rough", weights: { misfire: 5 } },
          {
            id: "dim_lights",
            label: "Lights dim or electrics acting up",
            weights: { charging: 4 },
          },
          NOT_SURE,
        ],
      },
    ],
  },
  {
    id: "noise",
    label: "Strange noise",
    emoji: "🔊",
    blurb: "Squeals, knocks, grinding or rattles",
    system: "suspension",
    causes: [
      {
        id: "brake_pads",
        name: "Worn brake pads or discs",
        system: "brakes",
        urgency: "soon",
        cost: "£90–£300 per axle",
        explain:
          "Squealing when braking is often the pad wear indicator. Grinding means metal on metal: get it done now.",
        check: "Look through the wheel at the pad thickness. Lip on the disc edge = worn.",
        prior: 2,
      },
      {
        id: "cv_joint",
        name: "Worn CV joint (driveshaft)",
        system: "suspension",
        urgency: "soon",
        cost: "£100–£300",
        explain:
          "A clicking or knocking when turning at low speed, especially on full lock, is the classic CV joint sign.",
        check:
          "Turn full lock in a car park and drive slowly in a circle. Look for a split rubber boot behind the wheel.",
        prior: 1,
      },
      {
        id: "suspension",
        name: "Worn suspension part (drop link, bush or spring)",
        system: "suspension",
        urgency: "soon",
        cost: "£60–£350",
        explain:
          "Clunks over bumps and speed humps usually come from drop links, bushes or a broken spring.",
        check: "Push down hard on each corner. Listen for a clunk; look for a snapped coil spring.",
        prior: 2,
      },
      {
        id: "aux_belt",
        name: "Slipping auxiliary (fan) belt",
        system: "engine",
        urgency: "soon",
        cost: "£60–£180",
        explain:
          "A squeal on cold starts or when revving is often the belt that drives the alternator and air-con.",
        check:
          "Look at the belt for cracks or shine. The squeal may get worse with lights and air-con on.",
        prior: 1.5,
      },
      {
        id: "wheel_bearing",
        name: "Wheel bearing",
        system: "suspension",
        urgency: "soon",
        cost: "£120–£300",
        explain:
          "A droning or roaring hum that rises with speed and changes when you steer left or right.",
        check: "Does the noise change when you weave gently at speed? That points to a bearing.",
        prior: 1,
      },
      {
        id: "heat_shield",
        name: "Loose exhaust heat shield",
        system: "exhaust",
        urgency: "monitor",
        cost: "£20–£80",
        explain: "A tinny rattle underneath, especially at certain revs or over bumps.",
        check: "With the car cold and parked, tap the exhaust and its shields.",
        prior: 1.5,
      },
      {
        id: "timing_chain",
        name: "Stretched timing chain",
        system: "engine",
        urgency: "stop",
        cost: "£500–£1,500",
        explain:
          "A rattle for a few seconds on a cold start can be a stretched timing chain. If it fails, the engine can be badly damaged.",
        check: "Listen right after a cold start. Get it checked before it gets worse.",
        prior: 0.5,
      },
      {
        id: "low_oil_tick",
        name: "Low oil or noisy tappets",
        system: "engine",
        urgency: "soon",
        cost: "£10–£400",
        explain: "A ticking from the top of the engine that speeds up with revs.",
        check: "Check the oil level first; topping up often quietens it.",
        prior: 1,
      },
      {
        id: "gearbox_whine",
        name: "Gearbox or differential whine",
        system: "gearbox",
        urgency: "soon",
        cost: "£80–£1,200",
        explain: "A whine that changes with speed or gear, not with engine revs.",
        check: "Does it change when you dip the clutch or go into neutral?",
        prior: 0.6,
      },
    ],
    questions: [
      {
        id: "sound",
        text: "What does it sound like?",
        options: [
          {
            id: "squeal",
            label: "Squeal or screech",
            emoji: "📢",
            weights: { brake_pads: 3, aux_belt: 3 },
          },
          {
            id: "grind",
            label: "Grinding",
            emoji: "⚙️",
            weights: { brake_pads: 5, wheel_bearing: 1 },
          },
          {
            id: "knock",
            label: "Knock, clunk or click",
            emoji: "🔨",
            weights: { suspension: 3, cv_joint: 3 },
          },
          {
            id: "rattle",
            label: "Rattle",
            emoji: "🥫",
            weights: { heat_shield: 4, timing_chain: 2 },
          },
          {
            id: "hum",
            label: "Hum, drone or roar",
            emoji: "🐝",
            weights: { wheel_bearing: 5, gearbox_whine: 1 },
          },
          { id: "whine", label: "Whine", emoji: "🎵", weights: { gearbox_whine: 4, aux_belt: 1 } },
          { id: "tick", label: "Ticking", emoji: "⏱️", weights: { low_oil_tick: 5 } },
          NOT_SURE,
        ],
      },
      {
        id: "when",
        text: "When does it happen?",
        options: [
          { id: "braking", label: "When braking", weights: { brake_pads: 6 } },
          { id: "turning", label: "When turning", weights: { cv_joint: 5, wheel_bearing: 1 } },
          { id: "bumps", label: "Over bumps", weights: { suspension: 5, heat_shield: 2 } },
          {
            id: "cold_start",
            label: "Just after a cold start",
            weights: { timing_chain: 4, aux_belt: 3, low_oil_tick: 1 },
          },
          {
            id: "speed",
            label: "At speed, getting louder",
            weights: { wheel_bearing: 4, gearbox_whine: 2 },
          },
          {
            id: "revving",
            label: "When revving or accelerating",
            weights: { aux_belt: 2, heat_shield: 2, low_oil_tick: 2 },
          },
          NOT_SURE,
        ],
      },
      {
        id: "where",
        text: "Where does it seem to come from?",
        options: [
          {
            id: "wheel",
            label: "A wheel",
            weights: { brake_pads: 2, wheel_bearing: 2, cv_joint: 2, suspension: 1 },
          },
          {
            id: "engine_bay",
            label: "The engine",
            weights: { aux_belt: 2, timing_chain: 2, low_oil_tick: 2 },
          },
          { id: "underneath", label: "Underneath", weights: { heat_shield: 3, gearbox_whine: 1 } },
          NOT_SURE,
        ],
      },
    ],
  },
  {
    id: "smoke",
    label: "Smoke or smell",
    emoji: "💨",
    blurb: "Smoke from the exhaust or a strange smell",
    system: "exhaust",
    causes: [
      {
        id: "head_gasket",
        name: "Head gasket or coolant burning",
        system: "engine",
        urgency: "stop",
        cost: "£600–£1,500",
        explain:
          "Thick white sweet-smelling smoke that doesn't clear once warm can mean coolant is getting into the engine.",
        check:
          "Is the coolant level dropping with no visible leak? Mayonnaise-like gunk under the oil cap is another sign.",
        prior: 0.7,
      },
      {
        id: "burning_oil",
        name: "Burning oil (worn seals or turbo)",
        system: "engine",
        urgency: "soon",
        cost: "£100–£1,500",
        explain:
          "Blue-grey smoke, especially on start-up or when accelerating, means oil is being burnt.",
        check: "Check how fast the oil level drops between top-ups.",
        prior: 1,
      },
      {
        id: "rich_fuel",
        name: "Running rich (injectors, sensor, turbo or DPF)",
        system: "fuel",
        urgency: "soon",
        cost: "£80–£900",
        explain:
          "Black smoke means too much fuel is being burnt. Common on diesels when accelerating hard.",
        check: "Get the fault codes read. A dirty air filter can contribute.",
        prior: 1,
      },
      {
        id: "condensation",
        name: "Condensation (normal)",
        system: "exhaust",
        urgency: "monitor",
        cost: "£0",
        explain:
          "Thin white vapour on cold mornings that disappears once the car's warm is normal.",
        check: "Does it vanish after 10 minutes of driving? Then it's fine.",
        prior: 2,
      },
      {
        id: "clutch_burn",
        name: "Slipping or overheated clutch",
        system: "gearbox",
        urgency: "soon",
        cost: "£400–£900",
        explain:
          "A burnt-paper smell after hill starts or heavy traffic is the clutch overheating.",
        check: "Do the revs rise without the car speeding up? That's a slipping clutch.",
        prior: 1,
      },
      {
        id: "electrical_burn",
        name: "Electrical fault (burning plastic)",
        system: "electrical",
        urgency: "stop",
        cost: "£50–£500",
        explain: "A burning-plastic smell can be wiring overheating: a fire risk.",
        check: "Stop, switch off and don't drive until it's checked.",
        prior: 0.5,
      },
      {
        id: "catalytic",
        name: "Catalytic converter / fuel mixture",
        system: "exhaust",
        urgency: "soon",
        cost: "£150–£1,000",
        explain:
          "A rotten-egg smell from the exhaust points to the catalytic converter or fuel mixture.",
        check: "Often comes with an engine light. Get the codes read.",
        prior: 0.6,
      },
      {
        id: "coolant_smell",
        name: "Coolant leaking onto the engine",
        system: "cooling",
        urgency: "soon",
        cost: "£80–£450",
        explain:
          "A sweet, syrupy smell, sometimes from the vents, means coolant is leaking somewhere hot.",
        check: "Check the coolant level when cold, and look for crusty marks on hoses.",
        prior: 1,
      },
    ],
    questions: [
      {
        id: "what",
        text: "What are you seeing or smelling?",
        options: [
          {
            id: "white_thick",
            label: "Thick white smoke, sweet smell",
            emoji: "⬜",
            weights: { head_gasket: 6, condensation: 1 },
            skip: ["smell"],
          },
          {
            id: "white_thin",
            label: "Thin white vapour on cold mornings",
            emoji: "🌫️",
            weights: { condensation: 7 },
            skip: ["smell"],
          },
          {
            id: "blue",
            label: "Blue or grey smoke",
            emoji: "🔵",
            weights: { burning_oil: 7 },
            skip: ["smell"],
          },
          {
            id: "black",
            label: "Black smoke",
            emoji: "⬛",
            weights: { rich_fuel: 7 },
            skip: ["smell"],
          },
          { id: "smell_only", label: "A smell, no smoke", emoji: "👃" },
          NOT_SURE,
        ],
      },
      {
        id: "smell",
        text: "What does it smell like?",
        options: [
          { id: "burnt_paper", label: "Burnt paper or carpet", weights: { clutch_burn: 6 } },
          {
            id: "plastic",
            label: "Burning plastic",
            weights: { electrical_burn: 7 },
            danger: "Burning plastic can be a wiring fire risk.",
          },
          { id: "eggs", label: "Rotten eggs", weights: { catalytic: 7 } },
          { id: "sweet", label: "Sweet and syrupy", weights: { coolant_smell: 6, head_gasket: 1 } },
          { id: "oil", label: "Hot oil", weights: { burning_oil: 4 } },
          NOT_SURE,
        ],
      },
      {
        id: "when",
        text: "When does it happen?",
        options: [
          { id: "startup", label: "On start-up", weights: { burning_oil: 2, condensation: 2 } },
          {
            id: "accelerating",
            label: "When accelerating",
            weights: { rich_fuel: 2, burning_oil: 1, clutch_burn: 1 },
          },
          { id: "all_time", label: "All the time, even warm", weights: { head_gasket: 3 } },
          { id: "hills_traffic", label: "After hills or traffic", weights: { clutch_burn: 3 } },
          NOT_SURE,
        ],
      },
    ],
  },
  {
    id: "wont_start",
    label: "Won't start",
    emoji: "🔑",
    blurb: "Clicks, cranks or does nothing",
    system: "electrical",
    causes: [
      {
        id: "flat_battery",
        name: "Flat or failing battery",
        system: "electrical",
        urgency: "soon",
        cost: "£0–£150",
        explain:
          "The most common reason a car won't start, especially in cold weather or after sitting.",
        check:
          "Dim dash lights or a fast clicking = battery. Try a jump start; batteries over 5 years old often need replacing.",
        prior: 4,
      },
      {
        id: "starter",
        name: "Starter motor fault",
        system: "electrical",
        urgency: "soon",
        cost: "£150–£450",
        explain: "A single loud click with bright dash lights often means the starter motor.",
        check: "If a jump start doesn't help and the lights stay bright, suspect the starter.",
        prior: 1,
      },
      {
        id: "immobiliser",
        name: "Key or immobiliser problem",
        system: "electrical",
        urgency: "soon",
        cost: "£5–£200",
        explain: "If the key battery is dead or the key isn't recognised, the car won't start.",
        check: "Try the spare key, or hold the key fob right against the start button.",
        prior: 1,
      },
      {
        id: "fuel_supply",
        name: "Fuel problem (empty, pump or filter)",
        system: "fuel",
        urgency: "soon",
        cost: "£0–£500",
        explain: "Cranks normally but won't fire? It may not be getting fuel.",
        check:
          "Is there fuel? Listen for a 2-second hum from the back when you turn the ignition on.",
        prior: 1.5,
      },
      {
        id: "glow_plugs",
        name: "Glow plugs (diesel, cold starts)",
        system: "engine",
        urgency: "soon",
        cost: "£100–£350",
        explain: "Diesels that struggle to start on cold mornings often have worn glow plugs.",
        check:
          "Wait for the coil light to go out before cranking. Starts fine when warm? That points here.",
        prior: 0.8,
      },
      {
        id: "terminals",
        name: "Loose or corroded battery terminals",
        system: "electrical",
        urgency: "monitor",
        cost: "£0–£50",
        explain: "A poor connection can look exactly like a flat battery.",
        check: "Look for white or green crust on the battery terminals and check they're tight.",
        prior: 1,
      },
    ],
    questions: [
      {
        id: "what",
        text: "What happens when you try to start it?",
        options: [
          {
            id: "nothing",
            label: "Nothing at all, no lights",
            weights: { flat_battery: 6, terminals: 3 },
          },
          {
            id: "clicks",
            label: "Clicking",
            weights: { flat_battery: 4, starter: 3, terminals: 1 },
          },
          { id: "slow", label: "Turns over slowly", weights: { flat_battery: 6 } },
          {
            id: "cranks",
            label: "Turns over normally but won't fire",
            weights: { fuel_supply: 5, glow_plugs: 2, immobiliser: 2 },
          },
          {
            id: "starts_dies",
            label: "Starts then cuts out",
            weights: { immobiliser: 4, fuel_supply: 3 },
          },
          NOT_SURE,
        ],
      },
      {
        id: "conditions",
        text: "Anything else true?",
        options: [
          { id: "cold", label: "It's cold out", weights: { flat_battery: 2, glow_plugs: 3 } },
          { id: "sat", label: "Not used for a week or more", weights: { flat_battery: 4 } },
          { id: "low_fuel", label: "Fuel is very low", weights: { fuel_supply: 5 } },
          { id: "key_warning", label: "Key or immobiliser message", weights: { immobiliser: 7 } },
          NOT_SURE,
        ],
      },
      {
        id: "jump",
        text: "Have you tried a jump start?",
        options: [
          { id: "jump_worked", label: "Yes, and it started", weights: { flat_battery: 5 } },
          {
            id: "jump_failed",
            label: "Yes, but it still won't start",
            weights: { starter: 3, fuel_supply: 2, immobiliser: 2, flat_battery: -3 },
          },
          { id: "no_jump", label: "Not yet" },
        ],
      },
    ],
  },
  {
    id: "driving",
    label: "Drives strangely",
    emoji: "🛞",
    blurb: "Pulling, shaking, juddering or slow",
    system: "suspension",
    causes: [
      {
        id: "alignment",
        name: "Wheel alignment or uneven tyre pressures",
        system: "tyres_wheels",
        urgency: "soon",
        cost: "£0–£80",
        explain: "A gentle pull to one side is usually tracking or a low tyre.",
        check: "Check all four tyre pressures first. Look for uneven wear on the tyre edges.",
        prior: 2,
      },
      {
        id: "balance",
        name: "Wheels out of balance",
        system: "tyres_wheels",
        urgency: "soon",
        cost: "£20–£60",
        explain:
          "Vibration through the steering wheel at 50–70 mph often means a wheel balance weight has fallen off.",
        check: "Does it come in at a certain speed and fade above it? Classic balance.",
        prior: 2,
      },
      {
        id: "warped_discs",
        name: "Warped brake discs",
        system: "brakes",
        urgency: "soon",
        cost: "£150–£350",
        explain: "Juddering through the pedal or steering when braking from speed.",
        check: "Only when braking? That points to discs.",
        prior: 1.5,
      },
      {
        id: "sticking_caliper",
        name: "Sticking brake caliper",
        system: "brakes",
        urgency: "stop",
        cost: "£100–£300",
        explain:
          "Pulling to one side with one wheel much hotter than the others. The brake is dragging.",
        check:
          "After a drive, carefully hold your hand near each wheel (don't touch). One very hot = sticking.",
        prior: 0.6,
      },
      {
        id: "clutch_judder",
        name: "Clutch or dual-mass flywheel judder",
        system: "gearbox",
        urgency: "soon",
        cost: "£400–£1,200",
        explain: "Shuddering when pulling away in first gear.",
        check:
          "Only when setting off? A rattle at idle that stops when you press the clutch points to the flywheel.",
        prior: 1,
      },
      {
        id: "boost_leak",
        name: "Turbo or boost leak",
        system: "engine",
        urgency: "soon",
        cost: "£80–£1,200",
        explain: "Loss of power, often with a whistle or limp mode on turbo cars.",
        check: "Listen for a hiss or whistle when accelerating. Check for split hoses.",
        prior: 1,
      },
      {
        id: "limp_mode",
        name: "Limp mode (EGR, DPF or sensor)",
        system: "engine",
        urgency: "soon",
        cost: "£60–£900",
        explain: "The engine protects itself by cutting power when it sees a fault.",
        check: "Usually comes with a warning light. Get the codes read.",
        prior: 1,
      },
      {
        id: "worn_tyres",
        name: "Worn, damaged or bulging tyre",
        system: "tyres_wheels",
        urgency: "stop",
        cost: "£50–£200 per tyre",
        explain: "A bulge or a worn-out tyre can cause wobbling and can blow out.",
        check: "Look at each tyre for bulges, cuts and tread below 1.6 mm (the legal minimum).",
        prior: 0.8,
      },
      {
        id: "steering_fault",
        name: "Power steering fault",
        system: "steering",
        urgency: "soon",
        cost: "£100–£700",
        explain:
          "Heavy steering, especially at low speed, means the power assistance isn't working.",
        check: "Is there a steering warning light? On hydraulic systems check the fluid level.",
        prior: 0.6,
      },
    ],
    questions: [
      {
        id: "feel",
        text: "What does it feel like?",
        options: [
          {
            id: "pulls",
            label: "Pulls to one side",
            weights: { alignment: 4, sticking_caliper: 3 },
          },
          {
            id: "vibration",
            label: "Vibration or shaking",
            weights: { balance: 4, warped_discs: 2, worn_tyres: 2 },
          },
          {
            id: "judder_pullaway",
            label: "Judders when pulling away",
            weights: { clutch_judder: 6 },
          },
          { id: "no_power", label: "Down on power", weights: { boost_leak: 4, limp_mode: 4 } },
          { id: "heavy_steering", label: "Steering is heavy", weights: { steering_fault: 6 } },
          NOT_SURE,
        ],
      },
      {
        id: "when",
        text: "When does it happen?",
        options: [
          {
            id: "braking",
            label: "Only when braking",
            weights: { warped_discs: 5, sticking_caliper: 2 },
          },
          {
            id: "certain_speed",
            label: "At a certain speed (e.g. 50–70 mph)",
            weights: { balance: 5 },
          },
          {
            id: "all_time",
            label: "All the time",
            weights: { alignment: 2, worn_tyres: 2, sticking_caliper: 1 },
          },
          {
            id: "accelerating",
            label: "When accelerating",
            weights: { boost_leak: 2, limp_mode: 2, clutch_judder: 1 },
          },
          NOT_SURE,
        ],
      },
      {
        id: "extra",
        text: "Anything else?",
        options: [
          {
            id: "hot_wheel",
            label: "One wheel smells hot or smokes",
            weights: { sticking_caliper: 7 },
            danger: "A dragging brake can overheat and fail.",
          },
          {
            id: "warning_light",
            label: "A warning light is on",
            weights: { limp_mode: 4, steering_fault: 2 },
          },
          { id: "whistle", label: "A whistle or hiss", weights: { boost_leak: 5 } },
          {
            id: "tyre_damage",
            label: "A tyre looks damaged or worn",
            weights: { worn_tyres: 7 },
            danger: "A damaged tyre can blow out.",
          },
          { id: "nothing", label: "Nothing else" },
        ],
      },
    ],
  },
  {
    id: "overheating",
    label: "Overheating",
    emoji: "🌡️",
    blurb: "Temperature high, steam or cold heater",
    system: "cooling",
    causes: [
      {
        id: "low_coolant",
        name: "Low coolant (leak somewhere)",
        system: "cooling",
        urgency: "stop",
        cost: "£10–£450",
        explain: "The most common cause. Running low lets the engine overheat.",
        check: "Once cold, check the coolant tank. If it's low, top up and look for leaks.",
        prior: 3,
      },
      {
        id: "thermostat",
        name: "Thermostat stuck",
        system: "cooling",
        urgency: "soon",
        cost: "£80–£250",
        explain: "A stuck-shut thermostat stops coolant reaching the radiator.",
        check: "Temperature climbs fast but the top radiator hose stays cool? Thermostat.",
        prior: 1.5,
      },
      {
        id: "cooling_fan",
        name: "Radiator fan not working",
        system: "cooling",
        urgency: "soon",
        cost: "£100–£350",
        explain: "Fine on the move but overheats in traffic? The fan probably isn't kicking in.",
        check: "Let it idle hot and see if the fan behind the grille comes on.",
        prior: 1.5,
      },
      {
        id: "water_pump",
        name: "Water pump failing",
        system: "cooling",
        urgency: "soon",
        cost: "£200–£600",
        explain: "A leak or whine from the front of the engine with overheating.",
        check: "Look for drips below the pump area; often done with the cambelt.",
        prior: 1,
      },
      {
        id: "head_gasket_oh",
        name: "Head gasket",
        system: "engine",
        urgency: "stop",
        cost: "£600–£1,500",
        explain: "Coolant disappearing with no leak, white smoke or bubbling in the tank.",
        check:
          "Bubbles in the coolant tank with the engine running, or mayonnaise under the oil cap.",
        prior: 0.6,
      },
    ],
    questions: [
      {
        id: "when",
        text: "When does it get hot?",
        options: [
          { id: "traffic", label: "In traffic or when stopped", weights: { cooling_fan: 5 } },
          {
            id: "quickly",
            label: "Quickly, on any journey",
            weights: { thermostat: 3, low_coolant: 2 },
          },
          {
            id: "long_drives",
            label: "On long drives or hills",
            weights: { low_coolant: 2, water_pump: 2 },
          },
          NOT_SURE,
        ],
      },
      {
        id: "coolant",
        text: "What's the coolant level like (check when cold)?",
        options: [
          {
            id: "low",
            label: "Low or empty",
            weights: { low_coolant: 5, water_pump: 1, head_gasket_oh: 1 },
          },
          {
            id: "keeps_dropping",
            label: "Keeps dropping, can't see a leak",
            weights: { head_gasket_oh: 5 },
          },
          { id: "fine", label: "Looks fine", weights: { thermostat: 2, cooling_fan: 2 } },
          NOT_SURE,
        ],
      },
      {
        id: "other",
        text: "Anything else?",
        options: [
          {
            id: "heater_cold",
            label: "Heater blows cold",
            weights: { low_coolant: 3, thermostat: 2 },
          },
          {
            id: "white_smoke",
            label: "White smoke from the exhaust",
            weights: { head_gasket_oh: 5 },
            danger: "White smoke with overheating can mean head gasket failure.",
          },
          {
            id: "steam",
            label: "Steam from the bonnet",
            weights: { low_coolant: 3, water_pump: 2 },
            danger: "Steam means it's overheating now. Pull over and switch off.",
          },
          { id: "whine", label: "Whine from the front of the engine", weights: { water_pump: 4 } },
          { id: "nothing", label: "Nothing else" },
        ],
      },
    ],
  },
  {
    id: "electrical",
    label: "Electrics",
    emoji: "⚡",
    blurb: "Battery, lights, windows or screen",
    system: "electrical",
    causes: [
      {
        id: "parasitic",
        name: "Something draining the battery overnight",
        system: "electrical",
        urgency: "soon",
        cost: "£50–£250",
        explain: "If the battery's flat every morning, something is staying on.",
        check: "Check boot and glovebox lights, and any dashcam or tracker wired in permanently.",
        prior: 1.5,
      },
      {
        id: "old_battery",
        name: "Old battery",
        system: "electrical",
        urgency: "soon",
        cost: "£80–£200",
        explain: "Batteries last about 4–6 years and get worse in the cold.",
        check: "Many garages and parts shops test batteries for free.",
        prior: 2,
      },
      {
        id: "alternator",
        name: "Alternator not charging",
        system: "electrical",
        urgency: "soon",
        cost: "£150–£450",
        explain: "Lights dim and electrics act up while driving.",
        check: "A battery light on the dash and dimming headlights at idle.",
        prior: 1,
      },
      {
        id: "fuse",
        name: "Blown fuse",
        system: "electrical",
        urgency: "monitor",
        cost: "£1–£80",
        explain: "One thing stops working completely (a socket, the radio, wipers).",
        check: "Check the fuse box diagram in your handbook and look for a broken fuse.",
        prior: 2,
      },
      {
        id: "window_reg",
        name: "Window motor or regulator",
        system: "bodywork",
        urgency: "monitor",
        cost: "£80–£250",
        explain: "A window that's slow, noisy, drops or won't move.",
        check: "Listen for the motor whirring when you press the switch.",
        prior: 1,
      },
      {
        id: "bulb",
        name: "Blown bulb",
        system: "electrical",
        urgency: "soon",
        cost: "£5–£80",
        explain: "One light out is usually just the bulb. It's an MOT fail and you can be fined.",
        check: "Walk round the car with the lights and indicators on.",
        prior: 2,
      },
      {
        id: "software",
        name: "Infotainment software glitch",
        system: "software",
        urgency: "monitor",
        cost: "£0–£150",
        explain: "Screens freezing, Bluetooth or CarPlay dropping out.",
        check:
          "Hold the power or volume button for 10–20 seconds to reboot it. Check for software updates.",
        prior: 1.5,
      },
    ],
    questions: [
      {
        id: "what",
        text: "What's going wrong?",
        options: [
          {
            id: "flat_mornings",
            label: "Battery's flat in the mornings",
            weights: { parasitic: 4, old_battery: 4 },
          },
          {
            id: "dimming",
            label: "Lights dim or flicker while driving",
            weights: { alternator: 6 },
          },
          {
            id: "one_thing_dead",
            label: "One thing has stopped working",
            weights: { fuse: 5, bulb: 2 },
          },
          { id: "window", label: "A window or lock", weights: { window_reg: 6, fuse: 1 } },
          { id: "light_out", label: "A light is out", weights: { bulb: 7 } },
          { id: "screen", label: "Screen, Bluetooth or CarPlay", weights: { software: 7 } },
          NOT_SURE,
        ],
      },
      {
        id: "age",
        text: "How old is the battery?",
        options: [
          {
            id: "new",
            label: "Under 3 years",
            weights: { parasitic: 2, alternator: 1, old_battery: -2 },
          },
          { id: "old", label: "4 years or more", weights: { old_battery: 4 } },
          NOT_SURE,
        ],
      },
    ],
  },
  {
    id: "gearbox",
    label: "Gears & clutch",
    emoji: "⚙️",
    blurb: "Slipping, grinding or jerky changes",
    system: "gearbox",
    causes: [
      {
        id: "worn_clutch",
        name: "Worn clutch",
        system: "gearbox",
        urgency: "soon",
        cost: "£400–£900",
        explain: "Revs rise but the car doesn't speed up, especially in high gears or uphill.",
        check:
          "In 4th at low speed, floor it. If the revs flare without pulling, the clutch is slipping.",
        prior: 2,
      },
      {
        id: "clutch_hydraulics",
        name: "Clutch hydraulics (master or slave cylinder)",
        system: "gearbox",
        urgency: "soon",
        cost: "£100–£350",
        explain: "A spongy, sticking or floor-dropping clutch pedal.",
        check: "Check the brake/clutch fluid reservoir and look for leaks around the pedal.",
        prior: 1,
      },
      {
        id: "synchro",
        name: "Worn gearbox synchros",
        system: "gearbox",
        urgency: "soon",
        cost: "£300–£1,200",
        explain: "Grinding going into a particular gear, often 2nd or 3rd.",
        check: "Does it grind even with the clutch fully down and a slow change?",
        prior: 1,
      },
      {
        id: "auto_fluid",
        name: "Automatic gearbox fluid or solenoid",
        system: "gearbox",
        urgency: "soon",
        cost: "£150–£800",
        explain: "Delayed, harsh or jerky changes in an automatic.",
        check:
          "Has the gearbox oil ever been changed? Many 'sealed for life' boxes benefit from it.",
        prior: 1.5,
      },
      {
        id: "dsg",
        name: "DSG / dual-clutch unit (mechatronics or clutch pack)",
        system: "gearbox",
        urgency: "soon",
        cost: "£400–£1,800",
        explain: "Juddering at low speed or a gearbox warning on dual-clutch boxes.",
        check: "Common on DSG/PowerShift/EDC. Get a specialist to read the codes.",
        prior: 0.8,
      },
    ],
    questions: [
      {
        id: "type",
        text: "What kind of gearbox?",
        options: [
          {
            id: "manual",
            label: "Manual",
            weights: { worn_clutch: 2, clutch_hydraulics: 1, synchro: 1, auto_fluid: -5, dsg: -5 },
          },
          {
            id: "auto",
            label: "Automatic",
            weights: { auto_fluid: 3, dsg: 1, worn_clutch: -9, clutch_hydraulics: -9, synchro: -5 },
          },
          {
            id: "dsg",
            label: "Dual-clutch (DSG, S tronic, PowerShift)",
            weights: { dsg: 5, auto_fluid: 1, worn_clutch: -9, clutch_hydraulics: -9, synchro: -5 },
          },
          NOT_SURE,
        ],
      },
      {
        id: "symptom",
        text: "What's it doing?",
        options: [
          {
            id: "slipping",
            label: "Revs rise but no extra speed",
            weights: { worn_clutch: 6, auto_fluid: 2 },
          },
          {
            id: "grinding",
            label: "Grinding into gear",
            weights: { synchro: 5, clutch_hydraulics: 2 },
          },
          {
            id: "pedal",
            label: "Clutch pedal spongy, sticking or on the floor",
            weights: { clutch_hydraulics: 7 },
          },
          {
            id: "jerky",
            label: "Jerky, delayed or harsh changes",
            weights: { auto_fluid: 4, dsg: 4 },
          },
          { id: "judder", label: "Judders at low speed", weights: { dsg: 4, worn_clutch: 2 } },
          NOT_SURE,
        ],
      },
    ],
  },
  {
    id: "brakes",
    label: "Brakes",
    emoji: "🛑",
    blurb: "Soft pedal, pulling, noise or judder",
    system: "brakes",
    causes: [
      {
        id: "air_leak_fluid",
        name: "Air or leak in the brake system",
        system: "brakes",
        urgency: "stop",
        cost: "£60–£300",
        explain: "A soft or sinking pedal means the brakes may not stop you.",
        check:
          "Check the brake fluid level. Don't drive if the pedal feels spongy or goes to the floor.",
        prior: 1,
      },
      {
        id: "pads_worn",
        name: "Worn pads or discs",
        system: "brakes",
        urgency: "soon",
        cost: "£90–£300 per axle",
        explain: "Squealing or grinding when braking.",
        check: "Look through the wheel at the pads; a lip on the disc edge means it's worn.",
        prior: 3,
      },
      {
        id: "caliper",
        name: "Sticking caliper",
        system: "brakes",
        urgency: "stop",
        cost: "£100–£300",
        explain: "Pulling to one side when braking, or one wheel very hot.",
        check: "After a drive, hold your hand near each wheel (don't touch) to compare heat.",
        prior: 1,
      },
      {
        id: "discs_warped",
        name: "Warped discs",
        system: "brakes",
        urgency: "soon",
        cost: "£150–£350",
        explain: "Pulsing pedal or steering wobble when braking from speed.",
        check: "Only when braking from higher speeds? That points to discs.",
        prior: 1.5,
      },
      {
        id: "handbrake",
        name: "Handbrake needs adjusting or EPB fault",
        system: "brakes",
        urgency: "soon",
        cost: "£40–£300",
        explain: "A weak handbrake or electronic parking brake warning. It's an MOT fail.",
        check: "Does the car roll on a slope with the handbrake on?",
        prior: 1,
      },
    ],
    questions: [
      {
        id: "symptom",
        text: "What's happening?",
        options: [
          {
            id: "soft_pedal",
            label: "Pedal is soft, spongy or sinks",
            weights: { air_leak_fluid: 8 },
            danger: "A soft brake pedal can mean the brakes could fail.",
          },
          { id: "noise", label: "Squeal or grind", weights: { pads_worn: 6 } },
          {
            id: "pulls",
            label: "Pulls to one side when braking",
            weights: { caliper: 5, pads_worn: 1 },
          },
          { id: "judder", label: "Judder or pulsing", weights: { discs_warped: 6 } },
          { id: "handbrake", label: "Handbrake is weak", weights: { handbrake: 7 } },
          NOT_SURE,
        ],
      },
      {
        id: "extra",
        text: "Anything else?",
        options: [
          {
            id: "hot_smell",
            label: "Hot or burning smell from a wheel",
            weights: { caliper: 5 },
            danger: "A dragging brake can overheat.",
          },
          {
            id: "fluid_low",
            label: "Brake fluid is low",
            weights: { air_leak_fluid: 4, pads_worn: 1 },
          },
          {
            id: "warning",
            label: "Brake warning light",
            weights: { pads_worn: 2, air_leak_fluid: 2 },
          },
          { id: "nothing", label: "Nothing else" },
        ],
      },
    ],
  },
];

export type Answer = { questionId: string; optionId: string };

export type RankedCause = Cause & { likelihood: number };

export type DiagnosisResult = {
  area: Area;
  causes: RankedCause[];
  /** 0–100: how clearly the top cause stands out. */
  confidence: number;
  dangers: string[];
  answeredText: { question: string; answer: string }[];
};

export function findArea(id: string | null | undefined): Area | null {
  return AREAS.find((a) => a.id === id) ?? null;
}

/** The questions still to ask, given the answers so far (respects skips). */
export function questionsFor(area: Area, answers: Answer[]): Question[] {
  const skipped = new Set<string>();
  for (const a of answers) {
    const q = area.questions.find((x) => x.id === a.questionId);
    q?.options.find((o) => o.id === a.optionId)?.skip?.forEach((id) => skipped.add(id));
  }
  return area.questions.filter((q) => !skipped.has(q.id));
}

/** Scores every cause from the answers and returns the most likely few. */
export function diagnose(area: Area, answers: Answer[]): DiagnosisResult {
  const scores = new Map(area.causes.map((c) => [c.id, c.prior ?? 1]));
  const dangers: string[] = [];
  const answeredText: { question: string; answer: string }[] = [];
  let informative = 0;
  for (const a of answers) {
    const q = area.questions.find((x) => x.id === a.questionId);
    const opt = q?.options.find((o) => o.id === a.optionId);
    if (!q || !opt) continue;
    answeredText.push({ question: q.text, answer: opt.label });
    if (opt.danger) dangers.push(opt.danger);
    if (opt.weights && Object.keys(opt.weights).length) informative++;
    for (const [id, w] of Object.entries(opt.weights ?? {})) {
      if (scores.has(id)) scores.set(id, scores.get(id)! + w);
    }
  }
  const ranked = area.causes
    .map((c) => ({ cause: c, score: Math.max(0, scores.get(c.id)!) }))
    .sort((x, y) => y.score - x.score);
  const total = ranked.reduce((sum, r) => sum + r.score, 0) || 1;
  const top = ranked.slice(0, 3).filter((r) => r.score > 0);
  const causes = top.map((r) => ({ ...r.cause, likelihood: Math.round((r.score / total) * 100) }));
  // Confidence: the top cause's share, discounted when few answers told us anything.
  const share = causes[0]?.likelihood ?? 0;
  const confidence = Math.round(share * Math.min(1, 0.5 + informative * 0.25));
  // Anything marked "stop" that's in the running is worth a warning too.
  return { area, causes, confidence, dangers, answeredText };
}

/** Text for a community help post, written from the diagnosis so far. */
export function helpPostText(
  result: DiagnosisResult,
  car: string | null,
  description: string,
): string {
  const lines = [
    `${result.area.emoji} ${result.area.label}${car ? ` on my ${car}` : ""}.`,
    ...result.answeredText.map((a) => `• ${a.question} ${a.answer}`),
  ];
  if (description.trim()) lines.push("", description.trim());
  if (result.causes[0]) {
    lines.push(
      "",
      `RevMate's diagnosis thinks it might be: ${result.causes
        .slice(0, 2)
        .map((c) => c.name.toLowerCase())
        .join(" or ")}. Has anyone had this?`,
    );
  }
  return lines.join("\n");
}
