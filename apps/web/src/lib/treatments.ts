interface SideEffect {
  name: string;
  timing: string;
  severity: 'mild' | 'moderate' | 'severe';
  tip: string;
}

interface CriticalDay {
  day: number;
  label: string;
  watchFor: string[];
  whenToCall: string;
}

interface Treatment {
  slug: string;
  name: string;
  fullName: string;
  cancerTypes: string[];
  cycleLength: number;
  typicalCycles: number;
  description: string;
  commonSideEffects: SideEffect[];
  criticalDays: CriticalDay[];
  faqs: { question: string; answer: string }[];
}

export const treatments: Treatment[] = [
  {
    slug: 'folfox',
    name: 'FOLFOX',
    fullName: 'Folinic Acid, Fluorouracil, and Oxaliplatin',
    cancerTypes: ['colorectal cancer', 'colon cancer', 'rectal cancer'],
    cycleLength: 14,
    typicalCycles: 12,
    description: 'FOLFOX is one of the most common chemotherapy regimens for colorectal cancer. It combines three drugs given over 2 days every 2 weeks.',
    commonSideEffects: [
      { name: 'Neuropathy (tingling/numbness)', timing: 'during and after infusion, cumulative', severity: 'moderate', tip: 'Avoid cold foods and drinks during and for a few days after infusion. Wear gloves in cold weather.' },
      { name: 'Nausea and vomiting', timing: 'days 1–3', severity: 'moderate', tip: 'Take anti-nausea medication as prescribed before meals. Small, frequent meals work better than large ones.' },
      { name: 'Fatigue', timing: 'days 3–7, peaks around day 5', severity: 'moderate', tip: 'Plan rest on days 4–6. Light walks when energy allows can help with fatigue.' },
      { name: 'Mouth sores', timing: 'days 3–10', severity: 'mild', tip: 'Rinse with salt water or baking soda solution 4–6 times daily. Avoid alcohol-based mouthwash.' },
      { name: 'Diarrhea', timing: 'days 2–5', severity: 'moderate', tip: 'BRAT diet (bananas, rice, applesauce, toast). Call doctor if more than 4 loose stools per day.' },
      { name: 'Low blood counts', timing: 'days 7–14 (nadir)', severity: 'severe', tip: 'Wash hands frequently, avoid crowds, and take temperature if feeling unwell.' },
    ],
    criticalDays: [
      { day: 1, label: 'Infusion Day', watchFor: ['Allergic reaction to oxaliplatin (flushing, hives, difficulty breathing)'], whenToCall: 'Any signs of allergic reaction during infusion — tell nursing staff immediately.' },
      { day: 7, label: 'Nadir Approaching', watchFor: ['Increased fatigue', 'Fever', 'Signs of infection'], whenToCall: 'Fever over 100.4°F (38°C) — this is a medical emergency with low counts.' },
      { day: 10, label: 'Nadir (Lowest Blood Counts)', watchFor: ['Fever', 'Chills', 'Unusual bruising or bleeding', 'Extreme fatigue'], whenToCall: 'Any fever over 100.4°F, bleeding that won\'t stop, or feeling very unwell.' },
      { day: 14, label: 'Recovery / Next Cycle', watchFor: ['Counts recovering', 'Energy returning'], whenToCall: 'If you feel worse instead of better approaching cycle day.' },
    ],
    faqs: [
      { question: 'Is nausea normal on day 3 of FOLFOX?', answer: 'Yes. Days 2–4 are typically when nausea peaks after FOLFOX infusion. Make sure to take prescribed anti-nausea medications proactively, not just when nausea hits. Small frequent meals and ginger tea can also help.' },
      { question: 'Why does cold feel painful after FOLFOX?', answer: 'Oxaliplatin causes cold sensitivity — a tingling or burning sensation when touching cold objects or drinking cold liquids. This is one of FOLFOX\'s most common side effects. Avoid cold drinks, use gloves to handle refrigerator items, and protect your face in cold weather.' },
      { question: 'What blood counts should I watch?', answer: 'The most important are ANC (absolute neutrophil count) for infection risk, platelets for bleeding risk, and hemoglobin for anemia/fatigue. Your oncologist will tell you target ranges. Generally, ANC below 1.0 means high infection risk.' },
      { question: 'When should I call the oncology team?', answer: 'Call immediately for: fever over 100.4°F (38°C), severe vomiting (can\'t keep fluids down for 24 hours), signs of allergic reaction, severe diarrhea (more than 6 episodes per day), or any bleeding that won\'t stop.' },
      { question: 'How long does FOLFOX fatigue last?', answer: 'Fatigue typically peaks around days 4–6 of each cycle and gradually improves toward cycle day 10–12. Cumulative fatigue may build over multiple cycles. It usually improves significantly after completing treatment.' },
    ],
  },
  {
    slug: 'folfiri',
    name: 'FOLFIRI',
    fullName: 'Folinic Acid, Fluorouracil, and Irinotecan',
    cancerTypes: ['colorectal cancer', 'colon cancer', 'rectal cancer', 'gastric cancer'],
    cycleLength: 14,
    typicalCycles: 12,
    description: 'FOLFIRI is a colorectal cancer chemotherapy regimen that replaces oxaliplatin with irinotecan. Often used after FOLFOX or when neuropathy is a concern.',
    commonSideEffects: [
      { name: 'Diarrhea', timing: 'acute (first 24 hours) and delayed (days 3–10)', severity: 'severe', tip: 'Two types: early diarrhea during/after infusion (treatable with atropine) and late diarrhea days later (use loperamide aggressively at first sign).' },
      { name: 'Nausea', timing: 'days 1–4', severity: 'moderate', tip: 'Take prescribed anti-nausea medications on schedule. Ginger and small meals help between doses.' },
      { name: 'Fatigue', timing: 'days 2–7', severity: 'moderate', tip: 'Rest when tired. Light activity when possible. Fatigue often improves in the second week of each cycle.' },
      { name: 'Hair loss', timing: 'weeks 2–4 of treatment', severity: 'moderate', tip: 'Usually temporary. Discuss cold cap therapy with your oncology team if this is a concern.' },
      { name: 'Low blood counts (neutropenia)', timing: 'days 7–14', severity: 'severe', tip: 'Fever over 100.4°F with low counts is an emergency. Keep thermometer accessible at all times.' },
      { name: 'Mouth sores', timing: 'days 3–10', severity: 'mild', tip: 'Rinse with salt water frequently. Avoid spicy, acidic, or hard foods.' },
    ],
    criticalDays: [
      { day: 1, label: 'Infusion Day', watchFor: ['Early diarrhea (cholinergic reaction)', 'Cramping during infusion'], whenToCall: 'Diarrhea or sweating during infusion — nursing staff can give atropine.' },
      { day: 3, label: 'Late Diarrhea Watch', watchFor: ['Loose stools beginning', 'Cramping', 'Dehydration signs'], whenToCall: 'More than 4 loose stools per day — start loperamide and call the team.' },
      { day: 8, label: 'Nadir (Low Counts)', watchFor: ['Fever', 'Chills', 'Signs of infection'], whenToCall: 'Fever over 100.4°F — this can be life-threatening with low neutrophil counts.' },
    ],
    faqs: [
      { question: 'What\'s the difference between FOLFIRI and FOLFOX?', answer: 'FOLFIRI uses irinotecan instead of oxaliplatin. FOLFOX causes more neuropathy (nerve tingling), while FOLFIRI causes more diarrhea and hair loss. Your oncologist chooses based on your health profile and prior treatments.' },
      { question: 'How do I manage the diarrhea from FOLFIRI?', answer: 'There are two phases. Early diarrhea (during/within hours of infusion): the nursing team can treat with atropine. Late diarrhea (day 3+): take loperamide (Imodium) at the first loose stool — don\'t wait. Call the team if you have more than 4 episodes per day.' },
      { question: 'Will my hair grow back after FOLFIRI?', answer: 'Yes. Hair loss from FOLFIRI is temporary. Hair typically begins growing back 2–3 months after completing chemotherapy.' },
      { question: 'When should I call the oncology team?', answer: 'Call immediately for: fever over 100.4°F (38°C), severe diarrhea (more than 6 episodes per day or unable to keep fluids down), signs of dehydration (extreme thirst, dark urine, dizziness), or severe abdominal cramping.' },
    ],
  },
  {
    slug: 'folfirinox',
    name: 'FOLFIRINOX',
    fullName: 'Folinic Acid, Fluorouracil, Irinotecan, and Oxaliplatin',
    cancerTypes: ['pancreatic cancer', 'colorectal cancer'],
    cycleLength: 14,
    typicalCycles: 12,
    description: 'FOLFIRINOX is an aggressive four-drug regimen used for pancreatic cancer and some colorectal cancers. It is highly effective but has significant side effects.',
    commonSideEffects: [
      { name: 'Severe fatigue', timing: 'throughout treatment, cumulative', severity: 'severe', tip: 'This is one of the most demanding regimens. Plan for significant rest days 2–6. Reduce activity expectations significantly during treatment weeks.' },
      { name: 'Neuropathy', timing: 'cumulative, worsens over cycles', severity: 'moderate', tip: 'Avoid cold. Report worsening numbness to your oncologist — dose adjustments may be needed.' },
      { name: 'Diarrhea', timing: 'acute and delayed', severity: 'severe', tip: 'Aggressive loperamide management for late diarrhea. Have electrolyte drinks (Pedialyte) on hand.' },
      { name: 'Neutropenia', timing: 'days 7–14', severity: 'severe', tip: 'G-CSF injections (Neupogen/Neulasta) are often prescribed. Fever is an emergency.' },
      { name: 'Nausea and vomiting', timing: 'days 1–5', severity: 'severe', tip: 'Multiple anti-nausea medications are typically prescribed. Take them on schedule, not just when symptoms hit.' },
      { name: 'Hair loss', timing: 'weeks 2–4', severity: 'moderate', tip: 'Expected with this regimen. Temporary — grows back after treatment.' },
    ],
    criticalDays: [
      { day: 1, label: 'Infusion (46-hour pump)', watchFor: ['Nausea', 'Reaction to oxaliplatin or irinotecan', 'Pump site issues'], whenToCall: 'Any reaction during infusion, pump malfunction, or disconnection site problems.' },
      { day: 3, label: 'Pump Disconnect + Diarrhea Watch', watchFor: ['Late diarrhea onset', 'Dehydration'], whenToCall: 'More than 3 loose stools per day — start loperamide immediately and call team.' },
      { day: 8, label: 'Nadir', watchFor: ['Fever', 'Infection signs', 'Severe fatigue'], whenToCall: 'Any fever over 100.4°F. FOLFIRINOX nadir is often severe — don\'t wait to call.' },
    ],
    faqs: [
      { question: 'Is FOLFIRINOX the most intense chemo regimen?', answer: 'It\'s among the most intensive outpatient regimens. It uses four drugs and requires a 46-hour take-home pump. Patients generally need more support at home during FOLFIRINOX than other regimens.' },
      { question: 'How do I handle the at-home pump?', answer: 'The pump delivers fluorouracil for 46 hours after the infusion center visit. The nursing team will show you how to handle it, what to do if the tube comes out, and when to return for disconnection. Keep the disconnect instructions on your fridge.' },
      { question: 'When should I call the oncology team during FOLFIRINOX?', answer: 'Call immediately for: fever over 100.4°F, severe vomiting (unable to keep any fluids down for 12 hours), more than 4 loose stools per day, pump problems, or any new severe symptoms.' },
    ],
  },
  {
    slug: 'abvd',
    name: 'ABVD',
    fullName: 'Adriamycin, Bleomycin, Vinblastine, and Dacarbazine',
    cancerTypes: ['Hodgkin lymphoma'],
    cycleLength: 28,
    typicalCycles: 6,
    description: 'ABVD is the standard treatment for Hodgkin lymphoma. Four drugs are given on days 1 and 15 of each 28-day cycle.',
    commonSideEffects: [
      { name: 'Nausea', timing: 'days 1–3 after each infusion', severity: 'moderate', tip: 'Anti-nausea medications are typically very effective for ABVD. Take as prescribed starting the morning of infusion.' },
      { name: 'Fatigue', timing: 'cumulative, often worse in later cycles', severity: 'moderate', tip: 'Rest is important. Many patients maintain near-normal activity in early cycles but may need more rest by cycles 4–6.' },
      { name: 'Hair loss', timing: 'weeks 2–3 of first cycle', severity: 'moderate', tip: 'Expected with ABVD. Temporary — hair usually returns 3–6 months after treatment ends.' },
      { name: 'Lung toxicity (bleomycin)', timing: 'cumulative risk', severity: 'severe', tip: 'Report any new shortness of breath or cough immediately. Bleomycin can cause lung damage — your team monitors this closely.' },
      { name: 'Mouth sores', timing: 'days 5–12', severity: 'mild', tip: 'Rinse with salt water. Use soft toothbrush. Avoid spicy or acidic foods.' },
      { name: 'Low blood counts', timing: 'days 10–18', severity: 'moderate', tip: 'Fever during this window requires immediate medical attention.' },
    ],
    criticalDays: [
      { day: 1, label: 'Infusion Day 1 & Day 15', watchFor: ['Reaction to bleomycin or dacarbazine', 'Infusion site pain'], whenToCall: 'Any unusual symptoms during infusion — tell nursing staff immediately.' },
      { day: 10, label: 'Nadir', watchFor: ['Fever', 'Chills', 'Shortness of breath'], whenToCall: 'Fever over 100.4°F or any new breathing difficulty — call immediately.' },
    ],
    faqs: [
      { question: 'Why is shortness of breath so important to report with ABVD?', answer: 'Bleomycin (the "B" in ABVD) can cause pulmonary toxicity — lung damage — in some patients. Even mild new shortness of breath or a new cough should be reported to your oncology team promptly. They monitor lung function throughout treatment.' },
      { question: 'Is ABVD curative for Hodgkin lymphoma?', answer: 'ABVD has a high cure rate for Hodgkin lymphoma — over 80% for early-stage disease. This is one of the most treatable cancers with modern chemotherapy.' },
      { question: 'When should I call the oncology team?', answer: 'Call for: fever over 100.4°F, any new shortness of breath or cough (report same day), severe vomiting, or unusual bruising/bleeding.' },
    ],
  },
  {
    slug: 'r-chop',
    name: 'R-CHOP',
    fullName: 'Rituximab, Cyclophosphamide, Doxorubicin, Vincristine, and Prednisone',
    cancerTypes: ['diffuse large B-cell lymphoma', 'follicular lymphoma', 'non-Hodgkin lymphoma'],
    cycleLength: 21,
    typicalCycles: 6,
    description: 'R-CHOP is the standard treatment for B-cell non-Hodgkin lymphomas. Six drugs (including a targeted therapy) are given every 3 weeks.',
    commonSideEffects: [
      { name: 'Infusion reactions (rituximab)', timing: 'first infusion, first 2 hours', severity: 'moderate', tip: 'Rituximab infusion reactions are common on the first dose and much rarer after. Staff will premedicate and monitor closely.' },
      { name: 'Nausea', timing: 'days 1–4', severity: 'moderate', tip: 'Anti-nausea medications are effective. Take them proactively on a schedule.' },
      { name: 'Hair loss', timing: 'weeks 2–3 of first cycle', severity: 'moderate', tip: 'Complete hair loss is common with R-CHOP. It is temporary — hair returns after treatment.' },
      { name: 'Fatigue', timing: 'days 5–14, cumulative', severity: 'moderate', tip: 'Energy typically returns in the week before the next cycle. Plan demanding tasks for recovery weeks.' },
      { name: 'Neutropenia', timing: 'days 7–14 (nadir)', severity: 'severe', tip: 'Fever during nadir is a medical emergency. G-CSF injections may be prescribed to boost counts.' },
      { name: 'Steroid effects (prednisone)', timing: 'days 1–5', severity: 'mild', tip: 'Blood sugar may rise (watch for diabetes). Sleep may be disrupted — take prednisone in the morning.' },
    ],
    criticalDays: [
      { day: 1, label: 'Infusion Day', watchFor: ['Rituximab reaction (fever, chills, flushing, difficulty breathing)'], whenToCall: 'Any reaction during infusion — nursing staff will manage.' },
      { day: 8, label: 'Nadir Approaching', watchFor: ['Rising temperature', 'Fatigue worsening', 'Chills'], whenToCall: 'Fever over 100.4°F — neutropenic fever is an emergency.' },
      { day: 11, label: 'Nadir', watchFor: ['Fever', 'Infection signs', 'Bleeding'], whenToCall: 'Any fever over 100.4°F or signs of serious bleeding.' },
    ],
    faqs: [
      { question: 'What is rituximab and why is it in R-CHOP?', answer: 'Rituximab is a monoclonal antibody — a targeted therapy that specifically attacks B-cells bearing the CD20 protein. Adding it to standard CHOP chemotherapy significantly improved outcomes for B-cell lymphomas. It\'s now standard of care.' },
      { question: 'Will my hair grow back after R-CHOP?', answer: 'Yes — hair loss from R-CHOP is temporary. Hair typically begins growing back 2–3 months after completing treatment, though texture may be different initially.' },
      { question: 'What do the prednisone days feel like?', answer: 'The 5 days of prednisone often cause increased energy, insomnia, mood changes, and increased appetite. Blood sugar may rise, especially in diabetic patients. After stopping prednisone, fatigue often increases for a few days.' },
      { question: 'When should I call the oncology team?', answer: 'Call for: fever over 100.4°F (especially days 7–14), severe vomiting, signs of infection, unusual bleeding, or any chest pain or difficulty breathing.' },
    ],
  },
  {
    slug: 'ac-t',
    name: 'AC-T',
    fullName: 'Adriamycin, Cyclophosphamide, followed by Taxol (Paclitaxel)',
    cancerTypes: ['breast cancer'],
    cycleLength: 14,
    typicalCycles: 8,
    description: 'AC-T (dose-dense) is a common breast cancer regimen. Four cycles of AC are given every 2 weeks, followed by four cycles of Taxol every 2 weeks.',
    commonSideEffects: [
      { name: 'Nausea and vomiting (AC phase)', timing: 'days 1–5 of AC cycles', severity: 'severe', tip: 'AC is one of the most nausea-inducing regimens. Take all prescribed anti-nausea medications proactively, even if you feel okay.' },
      { name: 'Hair loss', timing: 'weeks 2–3 of first cycle', severity: 'severe', tip: 'Complete hair loss is expected with AC-T. Cold cap therapy may be an option — discuss with your team before starting.' },
      { name: 'Fatigue', timing: 'cumulative throughout all 8 cycles', severity: 'moderate', tip: 'Plan for significant fatigue, especially in the Taxol phase. Gentle walking can help.' },
      { name: 'Neuropathy (Taxol phase)', timing: 'cumulative with Taxol cycles', severity: 'moderate', tip: 'Report worsening tingling or numbness immediately. Taxol neuropathy can sometimes be permanent if not caught early.' },
      { name: 'Neutropenia', timing: 'days 7–12 each cycle', severity: 'severe', tip: 'Neulasta/G-CSF injection the day after each infusion is standard. Fever is always an emergency.' },
      { name: 'Joint and muscle aches (Taxol)', timing: 'days 3–5 of Taxol cycles', severity: 'moderate', tip: 'Aching in bones and muscles (often called "bone pain") is common after Taxol/Neulasta. Claritin (loratadine) started the day before infusion can help.' },
    ],
    criticalDays: [
      { day: 1, label: 'Infusion Day', watchFor: ['Reaction to Taxol (flushing, chest tightness, back pain)'], whenToCall: 'Any reaction during Taxol infusion — tell staff immediately, it is manageable if caught early.' },
      { day: 3, label: 'Bone Pain (Taxol cycles)', watchFor: ['Joint aches', 'Bone pain from Neulasta'], whenToCall: 'Severe unmanageable pain — call for guidance on pain management.' },
      { day: 8, label: 'Nadir', watchFor: ['Fever', 'Infection signs'], whenToCall: 'Fever over 100.4°F — neutropenic fever emergency.' },
    ],
    faqs: [
      { question: 'What\'s the difference between the AC and Taxol phases?', answer: 'AC (Adriamycin + Cyclophosphamide) causes more nausea and hair loss. The Taxol phase causes more neuropathy, muscle aches, and fatigue but less nausea. Most patients find the AC phase harder at the time, but the Taxol phase\'s fatigue is cumulative.' },
      { question: 'Why does Claritin help with bone pain after Taxol?', answer: 'Loratadine (Claritin) appears to reduce the bone pain caused by Neulasta (G-CSF), which stimulates bone marrow to produce white blood cells. Taking Claritin starting the day before infusion and continuing for 5–7 days can significantly reduce this side effect.' },
      { question: 'When should I call the oncology team?', answer: 'Always for: fever over 100.4°F. Also call for: severe vomiting (can\'t keep fluids down), Taxol infusion reaction, severe neuropathy (new numbness affecting walking), or severe bone pain not controlled with prescribed medications.' },
    ],
  },
  {
    slug: 'carbo-taxol',
    name: 'Carbo-Taxol',
    fullName: 'Carboplatin and Paclitaxel (Taxol)',
    cancerTypes: ['ovarian cancer', 'lung cancer', 'endometrial cancer', 'cervical cancer'],
    cycleLength: 21,
    typicalCycles: 6,
    description: 'Carboplatin + Paclitaxel is a widely used regimen across several cancer types. Given every 3 weeks for 6 cycles.',
    commonSideEffects: [
      { name: 'Neuropathy', timing: 'cumulative with each cycle', severity: 'moderate', tip: 'Report tingling or numbness early. It can become permanent if not addressed. Avoid extremes of hot and cold.' },
      { name: 'Fatigue', timing: 'days 5–14, cumulative', severity: 'moderate', tip: 'Energy usually returns in week 3. Plan activities around your better days.' },
      { name: 'Hair loss', timing: 'weeks 2–3 of first cycle', severity: 'moderate', tip: 'Temporary. Cold cap therapy is sometimes used for Taxol-based regimens — ask your team.' },
      { name: 'Nausea', timing: 'days 1–4', severity: 'moderate', tip: 'Less severe than some regimens. Anti-nausea medications usually manage it well.' },
      { name: 'Neutropenia', timing: 'days 10–18', severity: 'severe', tip: 'Fever is an emergency. Wash hands frequently and avoid sick contacts.' },
      { name: 'Allergic reaction (carboplatin)', timing: 'risk increases with later cycles', severity: 'severe', tip: 'Carboplatin allergy risk increases after cycle 6+. Staff will premedicate and monitor. Report any flushing, itching, or chest tightness during infusion.' },
    ],
    criticalDays: [
      { day: 1, label: 'Infusion Day', watchFor: ['Taxol reaction (back pain, chest tightness)', 'Carboplatin reaction in later cycles'], whenToCall: 'Any reaction during infusion.' },
      { day: 12, label: 'Nadir', watchFor: ['Fever', 'Chills', 'Unusual fatigue'], whenToCall: 'Fever over 100.4°F.' },
    ],
    faqs: [
      { question: 'When does carboplatin allergy risk increase?', answer: 'Carboplatin allergy (hypersensitivity) becomes more likely after exposure — typically risk rises from cycle 6 or 7 onward. Your team will premedicate with antihistamines and steroids and monitor closely. Report any flushing, itching, back pain, or difficulty breathing during infusion.' },
      { question: 'When should I call the oncology team?', answer: 'Call for: fever over 100.4°F, any reaction during infusion, worsening neuropathy (new numbness affecting hands/feet function), or inability to keep fluids down for 24 hours.' },
    ],
  },
  {
    slug: 'gemcitabine-cisplatin',
    name: 'Gem-Cis',
    fullName: 'Gemcitabine and Cisplatin',
    cancerTypes: ['bladder cancer', 'lung cancer', 'pancreatic cancer', 'biliary tract cancer'],
    cycleLength: 21,
    typicalCycles: 6,
    description: 'Gemcitabine + Cisplatin is used for bladder, lung, and other cancers. Given over 3 weeks with a rest week.',
    commonSideEffects: [
      { name: 'Nausea (cisplatin)', timing: 'acute (0–24 hours) and delayed (days 2–5)', severity: 'severe', tip: 'Cisplatin causes significant nausea. Multiple anti-nausea medications are prescribed — take them all as directed. IV fluids before and after cisplatin help protect kidneys.' },
      { name: 'Kidney damage (cisplatin)', timing: 'ongoing risk, monitored by labs', severity: 'severe', tip: 'Staying well hydrated is critical. Drink at least 2 liters of water daily. Avoid NSAIDs (ibuprofen, naproxen) during treatment.' },
      { name: 'Hearing changes', timing: 'cumulative', severity: 'moderate', tip: 'Report any ringing in ears (tinnitus) or hearing changes immediately.' },
      { name: 'Fatigue', timing: 'days 3–14', severity: 'moderate', tip: 'Rest during the week after treatment. Activity often returns in the off-week.' },
      { name: 'Neutropenia', timing: 'days 10–17', severity: 'severe', tip: 'Fever is an emergency during this window.' },
    ],
    criticalDays: [
      { day: 1, label: 'Cisplatin Day (with heavy hydration)', watchFor: ['Nausea', 'Reaction'], whenToCall: 'Any severe reaction during infusion.' },
      { day: 3, label: 'Delayed Nausea', watchFor: ['Vomiting', 'Inability to eat or drink'], whenToCall: 'Unable to keep fluids down — risk of dehydration and kidney stress.' },
      { day: 12, label: 'Nadir', watchFor: ['Fever', 'Signs of infection'], whenToCall: 'Fever over 100.4°F.' },
    ],
    faqs: [
      { question: 'Why is hydration so important with cisplatin?', answer: 'Cisplatin is processed through the kidneys and can cause permanent kidney damage without adequate hydration. You\'ll receive IV fluids during treatment. At home, drinking 2+ liters of water daily is important, especially the first few days after infusion.' },
      { question: 'When should I call the oncology team?', answer: 'Call for: fever over 100.4°F, severe vomiting (can\'t keep any fluids down for 12 hours), ringing in ears or hearing changes, reduced urination, or any severe symptoms.' },
    ],
  },
  {
    slug: 'beacopp',
    name: 'BEACOPP',
    fullName: 'Bleomycin, Etoposide, Adriamycin, Cyclophosphamide, Vincristine, Procarbazine, and Prednisone',
    cancerTypes: ['Hodgkin lymphoma (advanced stage)'],
    cycleLength: 21,
    typicalCycles: 6,
    description: 'Escalated BEACOPP is used for advanced Hodgkin lymphoma when ABVD is insufficient. It is more intensive with a higher side effect burden.',
    commonSideEffects: [
      { name: 'Severe neutropenia', timing: 'days 7–14 every cycle', severity: 'severe', tip: 'G-CSF injections are standard with BEACOPP. Fever is a medical emergency — go to ER if temperature is over 100.4°F.' },
      { name: 'Nausea and vomiting', timing: 'days 1–5', severity: 'severe', tip: 'BEACOPP causes significant nausea. Multiple anti-nausea medications are prescribed — take them all as scheduled.' },
      { name: 'Fatigue', timing: 'severe and cumulative', severity: 'severe', tip: 'Expect significant fatigue throughout BEACOPP treatment. Many patients require help with daily activities.' },
      { name: 'Hair loss', timing: 'weeks 2–3 of first cycle', severity: 'severe', tip: 'Complete hair loss expected. Temporary.' },
      { name: 'Lung toxicity (bleomycin)', timing: 'cumulative', severity: 'severe', tip: 'Report any new shortness of breath or cough immediately.' },
      { name: 'Fertility effects', timing: 'during treatment', severity: 'severe', tip: 'BEACOPP carries a higher risk of infertility than ABVD. Discuss fertility preservation with your team before starting if relevant.' },
    ],
    criticalDays: [
      { day: 7, label: 'Nadir Approaching', watchFor: ['Rising temperature', 'Fatigue increase'], whenToCall: 'Any fever over 100.4°F — go to the ER.' },
      { day: 10, label: 'Nadir', watchFor: ['Fever', 'Infection', 'Bleeding'], whenToCall: 'Fever over 100.4°F is a medical emergency.' },
    ],
    faqs: [
      { question: 'Why is BEACOPP used instead of ABVD for some patients?', answer: 'BEACOPP has a higher cure rate for advanced-stage Hodgkin lymphoma, but with more severe side effects. Oncologists weigh the benefit of better cancer control against the higher toxicity for each patient.' },
      { question: 'When should I call the oncology team?', answer: 'Call for: fever over 100.4°F (go to ER), any new shortness of breath, severe vomiting, or unusual bleeding.' },
    ],
  },
  {
    slug: 'cmf',
    name: 'CMF',
    fullName: 'Cyclophosphamide, Methotrexate, and Fluorouracil',
    cancerTypes: ['breast cancer'],
    cycleLength: 28,
    typicalCycles: 6,
    description: 'CMF is an older breast cancer regimen still used in some settings. Less intense than AC-T but still effective for certain patients.',
    commonSideEffects: [
      { name: 'Nausea', timing: 'days 1–4', severity: 'mild', tip: 'Generally more manageable than AC regimens. Anti-nausea medications usually provide good control.' },
      { name: 'Fatigue', timing: 'throughout treatment', severity: 'mild', tip: 'Less severe than many modern regimens. Many patients maintain near-normal activity.' },
      { name: 'Mouth sores', timing: 'days 5–14 (methotrexate)', severity: 'moderate', tip: 'Rinse with salt water or prescribed mouthwash. Leucovorin (given after methotrexate) helps protect against severe sores.' },
      { name: 'Bladder irritation', timing: 'days 1–3 (cyclophosphamide)', severity: 'mild', tip: 'Drink plenty of water the day of and after cyclophosphamide. Take it in the morning so you can hydrate throughout the day.' },
      { name: 'Hair thinning', timing: 'weeks 3–4 of treatment', severity: 'mild', tip: 'Hair thinning (not usually complete loss) is common. Hair returns to normal after treatment.' },
    ],
    criticalDays: [
      { day: 10, label: 'Nadir', watchFor: ['Fever', 'Signs of infection'], whenToCall: 'Fever over 100.4°F.' },
    ],
    faqs: [
      { question: 'Is CMF easier than other breast cancer regimens?', answer: 'Generally yes — CMF has a milder side effect profile than AC or AC-T, particularly for nausea and hair loss. It is often chosen for patients who are older, have other health conditions, or when the benefit of more intensive treatment doesn\'t outweigh the risks.' },
      { question: 'When should I call the oncology team?', answer: 'Call for: fever over 100.4°F, severe mouth sores making eating impossible, blood in urine (bladder irritation from cyclophosphamide), or any unexpected symptoms.' },
    ],
  },
];

export function getTreatmentBySlug(slug: string): Treatment | undefined {
  return treatments.find(t => t.slug === slug);
}

export function getAllSlugs(): string[] {
  return treatments.map(t => t.slug);
}
