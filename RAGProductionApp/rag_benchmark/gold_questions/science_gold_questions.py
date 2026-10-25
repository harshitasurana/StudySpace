# -*- coding: utf-8 -*-
# Gold question set for the NCERT-RAG-Eval-style benchmark, built against
# the REAL local RAGProductionApp corpus (Qdrant "docs" collection,
# 1632 chunks, 5 subjects). Each question is hand-written from actually
# reading the source chunk text (not synthetic/templated), with gold
# chunk id(s) recorded exactly as they exist in Qdrant today.
#
# Chapter: "Describing Motion Around Us" (Science, Class 9) — the closest
# direct analog to the reference paper's own "Motion" chapter.

GOLD_QUESTIONS = []

GOLD_QUESTIONS += [
    {
        "id": "motion_01",
        "chapter": "Describing Motion Around Us",
        "question": "What is displacement in the context of motion?",
        "gold_chunk_ids": ["3c1673f6-bcd8-5eb0-8a24-d0fa90980258", "f8d4eef0-f566-541d-a37a-325df44c0f1c"],
    },
    {
        "id": "motion_02",
        "chapter": "Describing Motion Around Us",
        "question": "What is the formula for average speed of an object?",
        "gold_chunk_ids": ["9931b455-955f-519f-bd8d-ec1c4d5e420e", "f8d4eef0-f566-541d-a37a-325df44c0f1c"],
    },
    {
        "id": "motion_03",
        "chapter": "Describing Motion Around Us",
        "question": "What is the SI unit of average speed and average velocity?",
        "gold_chunk_ids": ["d7579a81-862f-5eca-91d4-321af76a14a0"],
    },
    {
        "id": "motion_04",
        "chapter": "Describing Motion Around Us",
        "question": "What is the formula for average velocity of an object?",
        "gold_chunk_ids": ["d7579a81-862f-5eca-91d4-321af76a14a0", "f8d4eef0-f566-541d-a37a-325df44c0f1c"],
    },
    {
        "id": "motion_05",
        "chapter": "Describing Motion Around Us",
        "question": "What is the formula for average acceleration of an object?",
        "gold_chunk_ids": ["e4f16343-478d-5906-870c-2d951e9762c6", "f8d4eef0-f566-541d-a37a-325df44c0f1c"],
    },
    {
        "id": "motion_06",
        "chapter": "Describing Motion Around Us",
        "question": "What is the SI unit of average acceleration?",
        "gold_chunk_ids": ["e4f16343-478d-5906-870c-2d951e9762c6"],
    },
    {
        "id": "motion_07",
        "chapter": "Describing Motion Around Us",
        "question": "What does a straight line on a position-time graph indicate about the nature of motion?",
        "gold_chunk_ids": ["32f15116-c0f2-5508-975d-ee0a36003664"],
    },
    {
        "id": "motion_08",
        "chapter": "Describing Motion Around Us",
        "question": "What does the slope of a velocity-time graph represent?",
        "gold_chunk_ids": ["c9ccc26b-915f-5789-b4be-957ab55f8ae2"],
    },
    {
        "id": "motion_09",
        "chapter": "Describing Motion Around Us",
        "question": "What physical quantity does the area enclosed between a velocity-time graph and the time axis represent?",
        "gold_chunk_ids": ["6892bb96-cd4a-5fc7-a005-2f0bd68541ad", "c9ccc26b-915f-5789-b4be-957ab55f8ae2"],
    },
    {
        "id": "motion_10",
        "chapter": "Describing Motion Around Us",
        "question": "State the three kinematic equations for motion in a straight line with constant acceleration.",
        "gold_chunk_ids": ["18efc568-04c0-59a5-b7b7-24ca9b45f9c2", "f8d4eef0-f566-541d-a37a-325df44c0f1c"],
    },
    {
        "id": "motion_11",
        "chapter": "Describing Motion Around Us",
        "question": "What is uniform circular motion?",
        "gold_chunk_ids": ["d9a0f451-de1c-5321-bd58-34d530517dcb", "f8d4eef0-f566-541d-a37a-325df44c0f1c"],
    },
    {
        "id": "motion_12",
        "chapter": "Describing Motion Around Us",
        "question": "In uniform circular motion, is the object accelerating, and why?",
        "gold_chunk_ids": ["b521fc61-37e9-5669-81d8-b61707b22aef"],
    },
    {
        "id": "motion_13",
        "chapter": "Describing Motion Around Us",
        "question": "What is the formula for average speed of an object making one revolution of a circular path of radius R in time T?",
        "gold_chunk_ids": ["d9a0f451-de1c-5321-bd58-34d530517dcb"],
    },
    {
        "id": "motion_14",
        "chapter": "Describing Motion Around Us",
        "question": "What is the difference between uniform motion and non-uniform motion in a straight line?",
        "gold_chunk_ids": ["9931b455-955f-519f-bd8d-ec1c4d5e420e"],
    },
    {
        "id": "motion_15",
        "chapter": "Describing Motion Around Us",
        "question": "Can an object be moving very fast and still have zero acceleration? Explain.",
        "gold_chunk_ids": ["1b45d6b9-b0ad-5687-9ae1-4fc82700a867"],
    },
]

# Chapter: "How Forces Affect Motion" (Science, Class 9)

GOLD_QUESTIONS += [
    {
        "id": "forces_01",
        "chapter": "How Forces Affect Motion",
        "question": "State Newton's first law of motion.",
        "gold_chunk_ids": ["6e4da38a-5443-512c-ade6-3a28e1162fe2", "878a305d-87b0-5955-bf5e-04488ffbdb51"],
    },
    {
        "id": "forces_02",
        "chapter": "How Forces Affect Motion",
        "question": "State Newton's second law of motion.",
        "gold_chunk_ids": ["6e4da38a-5443-512c-ade6-3a28e1162fe2", "a91f2d78-57a7-5739-83c9-ca62219e4bfc"],
    },
    {
        "id": "forces_03",
        "chapter": "How Forces Affect Motion",
        "question": "State Newton's third law of motion.",
        "gold_chunk_ids": ["6e4da38a-5443-512c-ade6-3a28e1162fe2", "f9004e2e-f29d-5eaf-8b82-ac95d160d3a6"],
    },
    {
        "id": "forces_04",
        "chapter": "How Forces Affect Motion",
        "question": "What is the SI unit of force, and what does the magnitude of a force express?",
        "gold_chunk_ids": ["c53e02b7-a518-5887-b6ac-4258bf093bf1"],
    },
    {
        "id": "forces_05",
        "chapter": "How Forces Affect Motion",
        "question": "How is one newton of force defined?",
        "gold_chunk_ids": ["e4fa65d5-29b2-52aa-8f87-c5fbff51c0da"],
    },
    {
        "id": "forces_06",
        "chapter": "How Forces Affect Motion",
        "question": "What is the mathematical relationship between force, mass, and acceleration according to Newton's second law?",
        "gold_chunk_ids": ["e4fa65d5-29b2-52aa-8f87-c5fbff51c0da", "a91f2d78-57a7-5739-83c9-ca62219e4bfc"],
    },
    {
        "id": "forces_07",
        "chapter": "How Forces Affect Motion",
        "question": "What are balanced forces, and what happens to an object's motion when the forces acting on it are balanced?",
        "gold_chunk_ids": ["3fb99b36-b8b2-53d9-88c5-7e5efcc10205"],
    },
    {
        "id": "forces_08",
        "chapter": "How Forces Affect Motion",
        "question": "How do you calculate the magnitude and direction of the net force when two forces act on an object in the same direction versus in opposite directions?",
        "gold_chunk_ids": ["3fb99b36-b8b2-53d9-88c5-7e5efcc10205"],
    },
    {
        "id": "forces_09",
        "chapter": "How Forces Affect Motion",
        "question": "The Earth and a falling fruit exert equal and opposite gravitational forces on each other. Why does the fruit move towards the Earth while the Earth does not appear to move towards the fruit?",
        "gold_chunk_ids": ["52f14703-009b-5885-ac67-ff4d441effb9"],
    },
    {
        "id": "forces_10",
        "chapter": "How Forces Affect Motion",
        "question": "According to Newton's third law, do a pair of equal and opposite action-reaction forces act on the same object or on two different objects?",
        "gold_chunk_ids": ["3964147f-dcfc-51db-8af0-4616580040aa", "f9004e2e-f29d-5eaf-8b82-ac95d160d3a6"],
    },
    {
        "id": "forces_11",
        "chapter": "How Forces Affect Motion",
        "question": "For a system of two objects connected by a string, with an external force F pulling them, what is the formula for the acceleration of the system?",
        "gold_chunk_ids": ["b6ab414c-4dfd-5f82-8ec8-bf34a9d2437f"],
    },
    {
        "id": "forces_12",
        "chapter": "How Forces Affect Motion",
        "question": "Why does a moving object eventually come to rest after you stop applying a force to it, such as a bicycle after you stop pedalling?",
        "gold_chunk_ids": ["467f95c4-5ac2-50cb-93b8-8240714af7f5"],
    },
    {
        "id": "forces_13",
        "chapter": "How Forces Affect Motion",
        "question": "What does the conclusion of the friction investigation activity say about how the force of friction depends on the nature of the surfaces in contact?",
        "gold_chunk_ids": ["14b946e8-7a50-5b23-8a0a-c87fb80ec8fb", "878a305d-87b0-5955-bf5e-04488ffbdb51"],
    },
    {
        "id": "forces_14",
        "chapter": "How Forces Affect Motion",
        "question": "How does an inflated airbag in a vehicle reduce the risk of injury during a collision?",
        "gold_chunk_ids": ["e5485217-14de-58c4-afaa-6a16f0b14f8f"],
    },
    {
        "id": "forces_15",
        "chapter": "How Forces Affect Motion",
        "question": "When a 0.1 kg bullet is fired from a 5 kg gun with a recoil force of 2 N, why are the accelerations of the bullet and the gun different even though the force on each is equal in magnitude?",
        "gold_chunk_ids": ["52f14703-009b-5885-ac67-ff4d441effb9"],
    },
]

# Chapter: "Sound Waves: Characteristics and Applications" (Science, Class 9)

GOLD_QUESTIONS += [
    {
        "id": "sound_01",
        "chapter": "Sound Waves: Characteristics and Applications",
        "question": "What is the human audible frequency range, and what are sound waves below and above this range called?",
        "gold_chunk_ids": ["1260411c-9a16-524a-9205-8cbaba2452ee"],
    },
    {
        "id": "sound_02",
        "chapter": "Sound Waves: Characteristics and Applications",
        "question": "What is the amplitude of a sound wave?",
        "gold_chunk_ids": ["cce23424-5ddd-5369-8631-e9aa026c7fee"],
    },
    {
        "id": "sound_03",
        "chapter": "Sound Waves: Characteristics and Applications",
        "question": "What are the frequency and time period of a sound wave, and how are they mathematically related?",
        "gold_chunk_ids": ["bfb40980-7c12-5e5c-9f0d-f8eb27e68c72"],
    },
    {
        "id": "sound_04",
        "chapter": "Sound Waves: Characteristics and Applications",
        "question": "What is the formula relating the speed, wavelength, and frequency of a sound wave?",
        "gold_chunk_ids": ["b05f3c16-e96f-5937-a999-324c49e2d7cf"],
    },
    {
        "id": "sound_05",
        "chapter": "Sound Waves: Characteristics and Applications",
        "question": "Does sound travel fastest in solids, liquids, or gases?",
        "gold_chunk_ids": ["b05f3c16-e96f-5937-a999-324c49e2d7cf"],
    },
    {
        "id": "sound_06",
        "chapter": "Sound Waves: Characteristics and Applications",
        "question": "What is an echo, and what is the minimum time gap needed between two sounds for the brain to distinguish them as separate?",
        "gold_chunk_ids": ["ee80c04b-921a-528d-9788-ac851394809c"],
    },
    {
        "id": "sound_07",
        "chapter": "Sound Waves: Characteristics and Applications",
        "question": "What is reverberation, and how is it different from an echo?",
        "gold_chunk_ids": ["ee80c04b-921a-528d-9788-ac851394809c"],
    },
    {
        "id": "sound_08",
        "chapter": "Sound Waves: Characteristics and Applications",
        "question": "Why can sound not travel through a vacuum, and what experiment demonstrates this?",
        "gold_chunk_ids": ["e3e8f778-ab20-5ca7-b3a9-093bbffff5af"],
    },
    {
        "id": "sound_09",
        "chapter": "Sound Waves: Characteristics and Applications",
        "question": "What is the difference between a longitudinal wave and a transverse wave, and which type is a sound wave?",
        "gold_chunk_ids": ["9686c055-892f-5120-982c-149ff4577974"],
    },
    {
        "id": "sound_10",
        "chapter": "Sound Waves: Characteristics and Applications",
        "question": "What are compressions and rarefactions in a sound wave?",
        "gold_chunk_ids": ["c5f0df1e-c968-54f4-8ff7-e48d993e5a34"],
    },
    {
        "id": "sound_11",
        "chapter": "Sound Waves: Characteristics and Applications",
        "question": "What is pitch, and how is it related to the frequency of a sound?",
        "gold_chunk_ids": ["b5ba0ab5-7ff5-5aac-b859-90169da7a43b"],
    },
    {
        "id": "sound_12",
        "chapter": "Sound Waves: Characteristics and Applications",
        "question": "What is echolocation, and which animals besides bats use it?",
        "gold_chunk_ids": ["039707f4-4475-535a-a9cb-b5b8c50758b4"],
    },
    {
        "id": "sound_13",
        "chapter": "Sound Waves: Characteristics and Applications",
        "question": "What is sonar, and how is it used to determine the distance, direction, and speed of underwater objects?",
        "gold_chunk_ids": ["0d5d1e9f-918d-55d1-92a7-d993dae35f54"],
    },
    {
        "id": "sound_14",
        "chapter": "Sound Waves: Characteristics and Applications",
        "question": "What is the difference between a tone and a musical note in terms of fundamental frequency and overtones?",
        "gold_chunk_ids": ["b5b6b0a3-0d88-5a54-9d3f-8d16b5512c95"],
    },
    {
        "id": "sound_15",
        "chapter": "Sound Waves: Characteristics and Applications",
        "question": "Why is sound classified as a mechanical wave, and why can astronauts not directly hear each other speak during a spacewalk?",
        "gold_chunk_ids": ["8d5b0aa4-cae5-5857-a973-c014ad22f6b0", "e3e8f778-ab20-5ca7-b3a9-093bbffff5af"],
    },
]

# Chapter: "Work, Energy, and Simple Machines" (Science, Class 9)

GOLD_QUESTIONS += [
    {
        "id": "work_01",
        "chapter": "Work, Energy, and Simple Machines",
        "question": "What is the scientific definition of work done by a constant force on an object?",
        "gold_chunk_ids": ["2f31a9aa-a367-5766-adf4-d41406302f70"],
    },
    {
        "id": "work_02",
        "chapter": "Work, Energy, and Simple Machines",
        "question": "What is the SI unit of work, and how is 1 joule of work defined?",
        "gold_chunk_ids": ["2269b77c-8c3b-550a-a1ef-8b3caa183375"],
    },
    {
        "id": "work_03",
        "chapter": "Work, Energy, and Simple Machines",
        "question": "Under what conditions is the work done on an object equal to zero?",
        "gold_chunk_ids": ["2269b77c-8c3b-550a-a1ef-8b3caa183375"],
    },
    {
        "id": "work_04",
        "chapter": "Work, Energy, and Simple Machines",
        "question": "What is the difference between positive work and negative work done by a force on an object?",
        "gold_chunk_ids": ["8d107d83-de61-543e-a002-e7822cb75ea5"],
    },
    {
        "id": "work_05",
        "chapter": "Work, Energy, and Simple Machines",
        "question": "What is the work-energy theorem?",
        "gold_chunk_ids": ["4c5fb5f4-bf3a-5292-bdaf-8403e62a162c"],
    },
    {
        "id": "work_06",
        "chapter": "Work, Energy, and Simple Machines",
        "question": "What is the formula for the kinetic energy of an object of mass m moving with velocity v?",
        "gold_chunk_ids": ["85f18865-5967-59e1-96c2-0a32797432a9"],
    },
    {
        "id": "work_07",
        "chapter": "Work, Energy, and Simple Machines",
        "question": "What is potential energy?",
        "gold_chunk_ids": ["26e9f2e7-2797-5462-a4d8-50674a4b8ba3"],
    },
    {
        "id": "work_08",
        "chapter": "Work, Energy, and Simple Machines",
        "question": "What is the formula for the gravitational potential energy of an object of mass m at height h above the ground?",
        "gold_chunk_ids": ["4a628e15-8cfa-5e3f-9a48-53d8a2dffeda"],
    },
    {
        "id": "work_09",
        "chapter": "Work, Energy, and Simple Machines",
        "question": "What is mechanical energy, and what does the law of conservation of mechanical energy state?",
        "gold_chunk_ids": ["a07892d1-cfbb-5267-ab81-e15038b00cc3", "cffe1c55-7bdb-588f-a79c-f6c4e091e7fc"],
    },
    {
        "id": "work_10",
        "chapter": "Work, Energy, and Simple Machines",
        "question": "What is power, and what is its SI unit?",
        "gold_chunk_ids": ["87426c8a-dc46-5e69-86ed-ee93e522092c"],
    },
    {
        "id": "work_11",
        "chapter": "Work, Energy, and Simple Machines",
        "question": "What is mechanical advantage, and how is it defined for a simple machine in terms of load and effort?",
        "gold_chunk_ids": ["1bcd7762-064b-536d-8b3c-762b02629838"],
    },
    {
        "id": "work_12",
        "chapter": "Work, Energy, and Simple Machines",
        "question": "Why does a fixed pulley have a mechanical advantage of 1, while a movable pulley system can have a mechanical advantage greater than 1?",
        "gold_chunk_ids": ["1bcd7762-064b-536d-8b3c-762b02629838"],
    },
    {
        "id": "work_13",
        "chapter": "Work, Energy, and Simple Machines",
        "question": "What is the formula for the mechanical advantage of an inclined plane in terms of its length and height?",
        "gold_chunk_ids": ["2561956a-80bf-5d9e-b3c1-96fdf8331f57"],
    },
    {
        "id": "work_14",
        "chapter": "Work, Energy, and Simple Machines",
        "question": "What are the three main parts of a lever, and what is the relationship between the forces applied at its two ends and the distances they move?",
        "gold_chunk_ids": ["6024cf81-394f-5ce0-aded-70c3c6d757eb", "69e9bbf6-eb80-52eb-bde9-3ad06a47f3c8"],
    },
    {
        "id": "work_15",
        "chapter": "Work, Energy, and Simple Machines",
        "question": "What are the three classes of levers, based on the relative positions of the fulcrum, load, and effort, and what are examples of each?",
        "gold_chunk_ids": ["f7182b97-a119-5608-99d2-9003c9fbdfd9"],
    },
]

# Chapter: "Nature's Balance" (Qdrant chapter label; actual textbook
# content is Chapter 12, "Patterns in Life: Diversity and Classification"
# — biodiversity and biological classification, Science, Class 9).
# Mix of question types (factual, historical who/when, examples,
# comprehension/why, true-false, ordered-list recall), per the explicit
# instruction to cover all levels and types of question, not just recall.

GOLD_QUESTIONS += [
    {
        "id": "natbal_01",
        "chapter": "Nature's Balance",
        "question": "Who proposed the five kingdom classification system, and in which year?",
        "gold_chunk_ids": ["d9c1dc5b-5ac9-5995-bb9c-c5a0095946eb"],
    },
    {
        "id": "natbal_02",
        "chapter": "Nature's Balance",
        "question": "What are the five kingdoms in Whittaker's classification system?",
        "gold_chunk_ids": ["60bbeefa-035a-5166-b88f-7c7b904068c6"],
    },
    {
        "id": "natbal_03",
        "chapter": "Nature's Balance",
        "question": "Who introduced the two kingdom classification system, and what were the two kingdoms?",
        "gold_chunk_ids": ["d9c1dc5b-5ac9-5995-bb9c-c5a0095946eb"],
    },
    {
        "id": "natbal_04",
        "chapter": "Nature's Balance",
        "question": "Who proposed the three domain system based on genetic data, and what are the three domains?",
        "gold_chunk_ids": ["81c0d89b-b223-5ad6-ac9c-fa728537cd8e"],
    },
    {
        "id": "natbal_05",
        "chapter": "Nature's Balance",
        "question": "Who introduced binomial nomenclature, and in which century?",
        "gold_chunk_ids": ["d2a87d50-f753-54b4-96ba-063189ad5ace"],
    },
    {
        "id": "natbal_06",
        "chapter": "Nature's Balance",
        "question": "What are the rules for writing a scientific name under the binomial nomenclature system?",
        "gold_chunk_ids": ["81c0d89b-b223-5ad6-ac9c-fa728537cd8e"],
    },
    {
        "id": "natbal_07",
        "chapter": "Nature's Balance",
        "question": "What is the scientific name of the tiger, and which part of that name is the genus?",
        "gold_chunk_ids": ["81c0d89b-b223-5ad6-ac9c-fa728537cd8e"],
    },
    {
        "id": "natbal_08",
        "chapter": "Nature's Balance",
        "question": "What are the five classes into which Kingdom Plantae is divided?",
        "gold_chunk_ids": ["7911816e-2c91-5105-aec0-659baccfb68d"],
    },
    {
        "id": "natbal_09",
        "chapter": "Nature's Balance",
        "question": "Why are bryophytes referred to as the 'amphibians' of the plant kingdom?",
        "gold_chunk_ids": ["b38da906-4535-57fd-a820-5847be131389"],
    },
    {
        "id": "natbal_10",
        "chapter": "Nature's Balance",
        "question": "What is the correct order of the biological classification hierarchy, from the broadest group to the most specific?",
        "gold_chunk_ids": ["adf59035-e052-5f9e-96b5-db728119cc5d"],
    },
    {
        "id": "natbal_11",
        "chapter": "Nature's Balance",
        "question": "On what basis are animals classified into non-chordata (invertebrates) and chordata?",
        "gold_chunk_ids": ["daea4df7-11cd-5c5e-b8f7-44262fd9db96"],
    },
    {
        "id": "natbal_12",
        "chapter": "Nature's Balance",
        "question": "What is a biodiversity hotspot, and name two regions mentioned in the chapter as examples?",
        "gold_chunk_ids": ["1810d1f8-6bdd-5ab0-b776-b14aac9702e5"],
    },
    {
        "id": "natbal_13",
        "chapter": "Nature's Balance",
        "question": "What is an endemic species? Give one example mentioned in the chapter.",
        "gold_chunk_ids": ["1810d1f8-6bdd-5ab0-b776-b14aac9702e5"],
    },
    {
        "id": "natbal_14",
        "chapter": "Nature's Balance",
        "question": "What do fossils reveal about how life has changed over time, according to the chapter?",
        "gold_chunk_ids": ["bceb8f71-f59c-5c5f-9313-78c8ac44d165"],
    },
    {
        "id": "natbal_15",
        "chapter": "Nature's Balance",
        "question": "True or False: According to the chapter, older rock layers generally contain more complex organisms than newer layers.",
        "gold_chunk_ids": ["bceb8f71-f59c-5c5f-9313-78c8ac44d165"],
    },
    {
        "id": "natbal_16",
        "chapter": "Nature's Balance",
        "question": "List the eight invertebrate phyla, in the order of increasing complexity of body organisation, given in the chapter.",
        "gold_chunk_ids": ["60bbeefa-035a-5166-b88f-7c7b904068c6"],
    },
    {
        "id": "natbal_17",
        "chapter": "Nature's Balance",
        "question": "Into which five groups are vertebrates classified?",
        "gold_chunk_ids": ["60bbeefa-035a-5166-b88f-7c7b904068c6", "adf59035-e052-5f9e-96b5-db728119cc5d"],
    },
    {
        "id": "natbal_18",
        "chapter": "Nature's Balance",
        "question": "What is a protochordate, and what example is given in the chapter?",
        "gold_chunk_ids": ["71ef56d0-e833-58ee-91f0-bd2c6b3e341d"],
    },
]

# Chapter: "Earth as a System: Energy, Matter, and Life" (Science, Class 9)

GOLD_QUESTIONS += [
    {
        "id": "earthsys_01",
        "chapter": "Earth as a System: Energy, Matter, and Life",
        "question": "What are the five interacting 'spheres' of the Earth system described in the chapter?",
        "gold_chunk_ids": ["ebb69634-829d-5368-b381-81a9bbc91799", "16ffbd50-d685-5e92-b5b8-99085f9c03d6"],
    },
    {
        "id": "earthsys_02",
        "chapter": "Earth as a System: Energy, Matter, and Life",
        "question": "What is the speed of light in vacuum, and how do sound waves differ from light in terms of needing a medium?",
        "gold_chunk_ids": ["8acc4542-7aec-5999-b7ed-745751ed4a46"],
    },
    {
        "id": "earthsys_03",
        "chapter": "Earth as a System: Energy, Matter, and Life",
        "question": "What is the solar constant, and what is its approximate value?",
        "gold_chunk_ids": ["8acc4542-7aec-5999-b7ed-745751ed4a46"],
    },
    {
        "id": "earthsys_04",
        "chapter": "Earth as a System: Energy, Matter, and Life",
        "question": "How much solar energy is received by a 1 square metre area in one hour if the insolation on the Earth's surface is 1 kWm-2?",
        "gold_chunk_ids": ["dc2b65f8-53b4-511e-b219-f9ab75a52477"],
    },
    {
        "id": "earthsys_05",
        "chapter": "Earth as a System: Energy, Matter, and Life",
        "question": "What is albedo, and which surfaces have higher albedo: snow and ice, or black soil and ocean water?",
        "gold_chunk_ids": ["b0ab2c4e-02fe-5463-9b5d-b0823f35ef82"],
    },
    {
        "id": "earthsys_06",
        "chapter": "Earth as a System: Energy, Matter, and Life",
        "question": "Why do equatorial regions remain warm throughout the year while polar regions stay much colder?",
        "gold_chunk_ids": ["2d41f10f-4537-5698-8461-d3c48429b9a7"],
    },
    {
        "id": "earthsys_07",
        "chapter": "Earth as a System: Energy, Matter, and Life",
        "question": "What are the two main gases that make up Earth's atmosphere, and their approximate percentages?",
        "gold_chunk_ids": ["2d41f10f-4537-5698-8461-d3c48429b9a7"],
    },
    {
        "id": "earthsys_08",
        "chapter": "Earth as a System: Energy, Matter, and Life",
        "question": "In which atmospheric layer does nearly all weather occur, and what is its approximate height?",
        "gold_chunk_ids": ["d17b376a-f412-542a-9aae-e1d66c0311be"],
    },
    {
        "id": "earthsys_09",
        "chapter": "Earth as a System: Energy, Matter, and Life",
        "question": "Why does temperature increase with height in the stratosphere, unlike in the troposphere?",
        "gold_chunk_ids": ["d17b376a-f412-542a-9aae-e1d66c0311be"],
    },
    {
        "id": "earthsys_10",
        "chapter": "Earth as a System: Energy, Matter, and Life",
        "question": "What causes a valley breeze during the day, and a mountain breeze at night?",
        "gold_chunk_ids": ["e280ae14-4b64-579a-869a-95981600b8ed"],
    },
    {
        "id": "earthsys_11",
        "chapter": "Earth as a System: Energy, Matter, and Life",
        "question": "How does the Earth's rotation affect the direction ocean gyres rotate in the Northern versus Southern Hemisphere?",
        "gold_chunk_ids": ["a16324ee-01a7-529f-a440-e4368822060b"],
    },
    {
        "id": "earthsys_12",
        "chapter": "Earth as a System: Energy, Matter, and Life",
        "question": "What are the main steps of the nitrogen cycle mentioned in the chapter?",
        "gold_chunk_ids": ["01be5daa-3d54-5896-a7cb-96046d7f2fb2"],
    },
    {
        "id": "earthsys_13",
        "chapter": "Earth as a System: Energy, Matter, and Life",
        "question": "Which bacteria are responsible for nitrogen fixation, and what compound do they convert atmospheric nitrogen into?",
        "gold_chunk_ids": ["01be5daa-3d54-5896-a7cb-96046d7f2fb2"],
    },
    {
        "id": "earthsys_14",
        "chapter": "Earth as a System: Energy, Matter, and Life",
        "question": "What is the difference between the 'fast' carbon cycle and the 'slow' carbon cycle?",
        "gold_chunk_ids": ["229835d9-a059-56de-9061-ef055bcdd6fa"],
    },
    {
        "id": "earthsys_15",
        "chapter": "Earth as a System: Energy, Matter, and Life",
        "question": "By approximately how much has atmospheric CO2 concentration risen since 1960, according to the chapter?",
        "gold_chunk_ids": ["229835d9-a059-56de-9061-ef055bcdd6fa"],
    },
    {
        "id": "earthsys_16",
        "chapter": "Earth as a System: Energy, Matter, and Life",
        "question": "True or False: According to the chapter, most of Earth's global carbon is stored in the atmosphere.",
        "gold_chunk_ids": ["229835d9-a059-56de-9061-ef055bcdd6fa"],
    },
    {
        "id": "earthsys_17",
        "chapter": "Earth as a System: Energy, Matter, and Life",
        "question": "What is eutrophication, and what human activity causes it according to the chapter?",
        "gold_chunk_ids": ["c632be7d-79bc-5470-a179-451fea9c69e8"],
    },
    {
        "id": "earthsys_18",
        "chapter": "Earth as a System: Energy, Matter, and Life",
        "question": "What international agreement helped begin the recovery of the ozone layer, and which chemicals were responsible for depleting it?",
        "gold_chunk_ids": ["e280ae14-4b64-579a-869a-95981600b8ed"],
    },
]

# Chapter: "Journey Inside the Atom" (Science, Class 9)

GOLD_QUESTIONS += [
    {
        "id": "atom1_01",
        "chapter": "Journey Inside the Atom",
        "question": "Who first proposed the idea of indivisible particles of matter in ancient India, and what did he call them?",
        "gold_chunk_ids": ["4e28790b-2a62-5ac9-aa51-eb0f269b2139"],
    },
    {
        "id": "atom1_02",
        "chapter": "Journey Inside the Atom",
        "question": "Who proposed the first scientific atomic theory in 1808, and what did it state about atoms?",
        "gold_chunk_ids": ["4e28790b-2a62-5ac9-aa51-eb0f269b2139"],
    },
    {
        "id": "atom1_03",
        "chapter": "Journey Inside the Atom",
        "question": "Who discovered the electron, and what experiment led to this discovery?",
        "gold_chunk_ids": ["72fc9300-6b10-583e-bc00-924e9a25401e"],
    },
    {
        "id": "atom1_04",
        "chapter": "Journey Inside the Atom",
        "question": "What was Thomson's model of the atom called, and how did it describe the arrangement of charge in an atom?",
        "gold_chunk_ids": ["72fc9300-6b10-583e-bc00-924e9a25401e"],
    },
    {
        "id": "atom1_05",
        "chapter": "Journey Inside the Atom",
        "question": "What surprising result from the gold foil experiment could Thomson's model not explain?",
        "gold_chunk_ids": ["03d14904-d289-5bba-9401-32219e8de197"],
    },
    {
        "id": "atom1_06",
        "chapter": "Journey Inside the Atom",
        "question": "Who conducted the gold foil experiment, under whose supervision, and in which year?",
        "gold_chunk_ids": ["03d14904-d289-5bba-9401-32219e8de197"],
    },
    {
        "id": "atom1_07",
        "chapter": "Journey Inside the Atom",
        "question": "What did Rutherford conclude about the structure of the atom based on the gold foil experiment?",
        "gold_chunk_ids": ["bdf3abe4-f7f2-5491-94b4-b350f538c902"],
    },
    {
        "id": "atom1_08",
        "chapter": "Journey Inside the Atom",
        "question": "What limitation did Rutherford's model have regarding the stability of atoms?",
        "gold_chunk_ids": ["53267f82-a478-576b-9538-161685013571"],
    },
    {
        "id": "atom1_09",
        "chapter": "Journey Inside the Atom",
        "question": "Who discovered the neutron, in which year, and what are its key properties?",
        "gold_chunk_ids": ["dadce9e7-5adf-5b4d-b038-43f91919ed96"],
    },
    {
        "id": "atom1_10",
        "chapter": "Journey Inside the Atom",
        "question": "According to Bohr's model, what are the fixed circular paths of electrons called, and how are the shells labeled?",
        "gold_chunk_ids": ["9a85ed9e-14e4-5dee-ab08-752644895b99"],
    },
    {
        "id": "atom1_11",
        "chapter": "Journey Inside the Atom",
        "question": "What is the formula for the maximum number of electrons a shell can hold, and how many electrons can the M-shell (n=3) accommodate?",
        "gold_chunk_ids": ["adc9ab80-6d74-53bb-a51e-0b2aaf99ccd6"],
    },
    {
        "id": "atom1_12",
        "chapter": "Journey Inside the Atom",
        "question": "What is valency, and how is it determined from an atom's number of valence electrons?",
        "gold_chunk_ids": ["10cee188-b7fa-50dc-92c7-12757f83a241"],
    },
    {
        "id": "atom1_13",
        "chapter": "Journey Inside the Atom",
        "question": "An atom has 79 protons and a mass number of 197. How many neutrons does it have?",
        "gold_chunk_ids": ["397f886d-4c8b-58ea-af16-c8568ede514e"],
    },
    {
        "id": "atom1_14",
        "chapter": "Journey Inside the Atom",
        "question": "What are isotopes? Name the three isotopes of hydrogen mentioned in the chapter.",
        "gold_chunk_ids": ["8652c95e-ab37-52b1-8862-b5812f0bcb1c"],
    },
    {
        "id": "atom1_15",
        "chapter": "Journey Inside the Atom",
        "question": "How is the weighted average atomic mass of chlorine (35.5 u) calculated from its two isotopes?",
        "gold_chunk_ids": ["c43c36ff-d63f-59d9-83c6-050b50033d4d"],
    },
    {
        "id": "atom1_16",
        "chapter": "Journey Inside the Atom",
        "question": "What are isobars? Give the example of three elements mentioned in the chapter that share the same mass number.",
        "gold_chunk_ids": ["d478d79a-b6b4-576d-88df-d59337cd888b"],
    },
    {
        "id": "atom1_17",
        "chapter": "Journey Inside the Atom",
        "question": "True or False: According to the chapter, electrons contribute significantly to the total mass of an atom.",
        "gold_chunk_ids": ["dadce9e7-5adf-5b4d-b038-43f91919ed96"],
    },
    {
        "id": "atom1_18",
        "chapter": "Journey Inside the Atom",
        "question": "Name one practical application of a radioactive isotope mentioned in the chapter.",
        "gold_chunk_ids": ["c43c36ff-d63f-59d9-83c6-050b50033d4d"],
    },
]

# Chapter: "Exploring Mixtures and their Separation" (Science, Class 9)

GOLD_QUESTIONS += [
    {
        "id": "mix_01",
        "chapter": "Exploring Mixtures and their Separation",
        "question": "What is the difference between a homogeneous mixture and a heterogeneous mixture?",
        "gold_chunk_ids": ["2e9cbb06-3cde-5d54-9110-90c2fe8ed053"],
    },
    {
        "id": "mix_02",
        "chapter": "Exploring Mixtures and their Separation",
        "question": "If 10 g of salt is dissolved in 90 g of water, what is the mass by mass percentage of the resulting solution?",
        "gold_chunk_ids": ["425a85e0-d35b-5c85-8b60-b49ae1e9d50e"],
    },
    {
        "id": "mix_03",
        "chapter": "Exploring Mixtures and their Separation",
        "question": "If 5 g of glucose is dissolved in water to make 100 mL of solution, what is its mass by volume percentage?",
        "gold_chunk_ids": ["425a85e0-d35b-5c85-8b60-b49ae1e9d50e"],
    },
    {
        "id": "mix_04",
        "chapter": "Exploring Mixtures and their Separation",
        "question": "If 1 mL of a liquid pesticide is mixed with water to form 100 mL of pesticide spray, what is its volume by volume percentage?",
        "gold_chunk_ids": ["db6c07cf-4154-5bb1-903f-b2b1c8ccaf2c"],
    },
    {
        "id": "mix_05",
        "chapter": "Exploring Mixtures and their Separation",
        "question": "What is a saturated solution, and how does the solubility of a solid solute in a liquid generally change with temperature?",
        "gold_chunk_ids": ["db6c07cf-4154-5bb1-903f-b2b1c8ccaf2c"],
    },
    {
        "id": "mix_06",
        "chapter": "Exploring Mixtures and their Separation",
        "question": "What is crystallization, and on what principle is it based?",
        "gold_chunk_ids": ["70097ae0-b4be-517a-9269-9aa560a136f0"],
    },
    {
        "id": "mix_07",
        "chapter": "Exploring Mixtures and their Separation",
        "question": "What is distillation, and what is the minimum difference in boiling points it requires between two miscible liquids?",
        "gold_chunk_ids": ["8fcfd2a6-4a4a-59b4-ba0e-0ecc5cf1493c", "fa1cb4bf-1188-55e4-bb6d-c053a4d5ffbd"],
    },
    {
        "id": "mix_08",
        "chapter": "Exploring Mixtures and their Separation",
        "question": "Why can a mixture of acetone and water be effectively separated by distillation?",
        "gold_chunk_ids": ["a1e6d9c0-b5c4-5a93-b28a-1b873053b748"],
    },
    {
        "id": "mix_09",
        "chapter": "Exploring Mixtures and their Separation",
        "question": "What is fractional distillation, and where is it used industrially?",
        "gold_chunk_ids": ["a1e6d9c0-b5c4-5a93-b28a-1b873053b748"],
    },
    {
        "id": "mix_10",
        "chapter": "Exploring Mixtures and their Separation",
        "question": "What is sublimation, and give an example of a substance that undergoes it.",
        "gold_chunk_ids": ["531ccc42-60e7-5ee4-85f5-522da999b78e"],
    },
    {
        "id": "mix_11",
        "chapter": "Exploring Mixtures and their Separation",
        "question": "What is paper chromatography, and where does the word 'chromatography' come from?",
        "gold_chunk_ids": ["f32dea7b-9d7e-596e-bba5-01bc5c7a08ce"],
    },
    {
        "id": "mix_12",
        "chapter": "Exploring Mixtures and their Separation",
        "question": "What is centrifugation, and what is it commonly used for in laboratories?",
        "gold_chunk_ids": ["62cff62a-f625-52a7-be32-5de09a3f2a06"],
    },
    {
        "id": "mix_13",
        "chapter": "Exploring Mixtures and their Separation",
        "question": "What is coagulation? Give an example of a coagulation process from everyday life mentioned in the chapter.",
        "gold_chunk_ids": ["969a484d-a91b-51d7-a7d1-a666964c7967"],
    },
    {
        "id": "mix_14",
        "chapter": "Exploring Mixtures and their Separation",
        "question": "What is the Tyndall effect, and after which scientist is it named?",
        "gold_chunk_ids": ["fc1bad75-f99a-5a5d-99bc-4ddb9c836769"],
    },
    {
        "id": "mix_15",
        "chapter": "Exploring Mixtures and their Separation",
        "question": "What are the approximate particle size ranges that distinguish solutions, colloids, and suspensions?",
        "gold_chunk_ids": ["fc1bad75-f99a-5a5d-99bc-4ddb9c836769"],
    },
    {
        "id": "mix_16",
        "chapter": "Exploring Mixtures and their Separation",
        "question": "True or False: Particles in a colloid settle down over time, just like particles in a suspension.",
        "gold_chunk_ids": ["fc1bad75-f99a-5a5d-99bc-4ddb9c836769"],
    },
    {
        "id": "mix_17",
        "chapter": "Exploring Mixtures and their Separation",
        "question": "What is an alloy, and give two examples of alloys mentioned in the chapter along with their approximate compositions.",
        "gold_chunk_ids": ["531ccc42-60e7-5ee4-85f5-522da999b78e"],
    },
    {
        "id": "mix_18",
        "chapter": "Exploring Mixtures and their Separation",
        "question": "What are emulsions, and give one example each of an oil-in-water and a water-in-oil emulsion mentioned in the chapter.",
        "gold_chunk_ids": ["539df146-aaaf-5a0b-a6bb-6ca4d3f237c3"],
    },
]

# Chapter: "Atomic Foundations of Matter" (Science, Class 9)

GOLD_QUESTIONS += [
    {
        "id": "atom2_01",
        "chapter": "Atomic Foundations of Matter",
        "question": "Who proposed the Law of Conservation of Mass, and in which year?",
        "gold_chunk_ids": ["d8c59912-dd0b-5dd0-8304-d482262dbd41"],
    },
    {
        "id": "atom2_02",
        "chapter": "Atomic Foundations of Matter",
        "question": "4.0 g of calcium carbonate reacted with 2.92 g of hydrochloric acid to produce 1.76 g of carbon dioxide, 0.72 g of water, and 4.44 g of calcium chloride. Does this obey the Law of Conservation of Mass?",
        "gold_chunk_ids": ["fcf723f2-cfc7-535f-88d9-5c6110125d72"],
    },
    {
        "id": "atom2_03",
        "chapter": "Atomic Foundations of Matter",
        "question": "12 g of carbon combines with 32 g of oxygen to form 44 g of carbon dioxide. How much carbon dioxide is produced if 2.4 g of carbon reacts completely with oxygen?",
        "gold_chunk_ids": ["fcf723f2-cfc7-535f-88d9-5c6110125d72"],
    },
    {
        "id": "atom2_04",
        "chapter": "Atomic Foundations of Matter",
        "question": "Who proposed the Law of Constant (Definite) Proportions?",
        "gold_chunk_ids": ["f32c3f67-11a6-5806-8f64-b32ca3dbd007"],
    },
    {
        "id": "atom2_05",
        "chapter": "Atomic Foundations of Matter",
        "question": "Sodium chloride contains sodium and chlorine in the mass ratio 23:35.5. If 46 g of sodium reacts completely, how much chlorine is needed to form NaCl?",
        "gold_chunk_ids": ["f32c3f67-11a6-5806-8f64-b32ca3dbd007"],
    },
    {
        "id": "atom2_06",
        "chapter": "Atomic Foundations of Matter",
        "question": "What are the main postulates of Dalton's atomic theory?",
        "gold_chunk_ids": ["fca5e583-094b-52e3-9e78-d168cb17d082"],
    },
    {
        "id": "atom2_07",
        "chapter": "Atomic Foundations of Matter",
        "question": "What is a covalent bond, and how is it formed between two atoms?",
        "gold_chunk_ids": ["73782cf5-925b-5819-b957-5a65f394ec10"],
    },
    {
        "id": "atom2_08",
        "chapter": "Atomic Foundations of Matter",
        "question": "What is an ionic bond, and how is it formed?",
        "gold_chunk_ids": ["e6190393-2ab0-5e1e-a2af-211c7fa5303e"],
    },
    {
        "id": "atom2_09",
        "chapter": "Atomic Foundations of Matter",
        "question": "Why does sodium chloride not conduct electricity in the solid state but does conduct electricity when dissolved in water?",
        "gold_chunk_ids": ["e6033006-0941-5f78-b511-84a711221533"],
    },
    {
        "id": "atom2_10",
        "chapter": "Atomic Foundations of Matter",
        "question": "What is the molecular mass of water (H2O), given the atomic mass of H = 1 u and O = 16 u?",
        "gold_chunk_ids": ["a1768455-5f39-54a7-ac83-c06c8784435b"],
    },
    {
        "id": "atom2_11",
        "chapter": "Atomic Foundations of Matter",
        "question": "What is the molecular mass of carbon dioxide (CO2), given the atomic mass of C = 12 u and O = 16 u?",
        "gold_chunk_ids": ["a1768455-5f39-54a7-ac83-c06c8784435b"],
    },
    {
        "id": "atom2_12",
        "chapter": "Atomic Foundations of Matter",
        "question": "What is the formula unit mass of sodium oxide (Na2O), given the atomic mass of Na = 23 u and O = 16 u?",
        "gold_chunk_ids": ["c197313b-caff-560a-9d6f-c838b950fd7c"],
    },
    {
        "id": "atom2_13",
        "chapter": "Atomic Foundations of Matter",
        "question": "How is carbon dioxide (CO2) named using the prefix system for naming covalent compounds, and which prefix indicates two atoms?",
        "gold_chunk_ids": ["daadb1e9-8691-52a3-abe4-446005ce489a"],
    },
    {
        "id": "atom2_14",
        "chapter": "Atomic Foundations of Matter",
        "question": "When naming ionic compounds, which part of the name is written first, and how do names of simple anions typically end?",
        "gold_chunk_ids": ["63dec64c-522d-5d5c-ae56-fb7939b00aad"],
    },
    {
        "id": "atom2_15",
        "chapter": "Atomic Foundations of Matter",
        "question": "Why are ionic compounds like sodium chloride generally soluble in water but insoluble in kerosene and petrol, while covalent compounds like camphor show the opposite trend?",
        "gold_chunk_ids": ["e6033006-0941-5f78-b511-84a711221533"],
    },
    {
        "id": "atom2_16",
        "chapter": "Atomic Foundations of Matter",
        "question": "True or False: According to the chapter, ionic compounds generally have low melting and boiling points due to weak inter-ionic attractions.",
        "gold_chunk_ids": ["a1768455-5f39-54a7-ac83-c06c8784435b"],
    },
    {
        "id": "atom2_17",
        "chapter": "Atomic Foundations of Matter",
        "question": "How is a molecule defined in the chapter?",
        "gold_chunk_ids": ["73782cf5-925b-5819-b957-5a65f394ec10"],
    },
    {
        "id": "atom2_18",
        "chapter": "Atomic Foundations of Matter",
        "question": "In the crystal structure of sodium chloride, how many chloride ions surround each sodium ion?",
        "gold_chunk_ids": ["e6190393-2ab0-5e1e-a2af-211c7fa5303e"],
    },
]

# Chapter: "Nature's Treasures" (Qdrant chapter label; actual textbook
# content is Chapter 2, "Cell: The Building Block of Life" — cell
# biology, Science, Class 9).

GOLD_QUESTIONS += [
    {
        "id": "cell_01",
        "chapter": "Nature's Treasures",
        "question": "Who is credited with formulating the classical Cell Theory, and what are its three main principles?",
        "gold_chunk_ids": ["49554329-bc62-52a2-9019-b190336ab179"],
    },
    {
        "id": "cell_02",
        "chapter": "Nature's Treasures",
        "question": "Who first observed a cell in 1665, and what did he name the small box-like compartments he saw?",
        "gold_chunk_ids": ["e22790f4-54c5-551d-9410-9c319f8a20d8"],
    },
    {
        "id": "cell_03",
        "chapter": "Nature's Treasures",
        "question": "What is the limit of resolution of the human eye?",
        "gold_chunk_ids": ["e22790f4-54c5-551d-9410-9c319f8a20d8"],
    },
    {
        "id": "cell_04",
        "chapter": "Nature's Treasures",
        "question": "What is the key structural difference between prokaryotic and eukaryotic cells?",
        "gold_chunk_ids": ["1049e459-8568-5b56-834d-b9153e33ab56"],
    },
    {
        "id": "cell_05",
        "chapter": "Nature's Treasures",
        "question": "What is osmosis, and in which direction does water move during this process?",
        "gold_chunk_ids": ["c99605bf-8dbe-5f01-a1c7-e4b9c24f5501"],
    },
    {
        "id": "cell_06",
        "chapter": "Nature's Treasures",
        "question": "Why does a plant cell's inner content shrink (but its overall boundary stay the same size) in a concentrated sugar solution, while an animal cell shrinks entirely?",
        "gold_chunk_ids": ["5fc9a1dd-00c1-5315-8c33-1ffaa6beed3e"],
    },
    {
        "id": "cell_07",
        "chapter": "Nature's Treasures",
        "question": "What is the function of mitochondria, and what is the energy-storing molecule they produce called?",
        "gold_chunk_ids": ["a033c348-b6c2-51b7-b1ac-9ec0c3c55dd7"],
    },
    {
        "id": "cell_08",
        "chapter": "Nature's Treasures",
        "question": "What is the function of the Golgi apparatus, and who first observed it and in which year?",
        "gold_chunk_ids": ["92cd56ec-0c56-54c2-905b-698eb331d3f0"],
    },
    {
        "id": "cell_09",
        "chapter": "Nature's Treasures",
        "question": "What is the function of lysosomes in a cell?",
        "gold_chunk_ids": ["92cd56ec-0c56-54c2-905b-698eb331d3f0"],
    },
    {
        "id": "cell_10",
        "chapter": "Nature's Treasures",
        "question": "What is the difference between Rough Endoplasmic Reticulum (RER) and Smooth Endoplasmic Reticulum (SER)?",
        "gold_chunk_ids": ["92cd56ec-0c56-54c2-905b-698eb331d3f0"],
    },
    {
        "id": "cell_11",
        "chapter": "Nature's Treasures",
        "question": "What are chromoplasts and leucoplasts, and how do they differ from chloroplasts?",
        "gold_chunk_ids": ["73065886-902f-53ea-babb-7af92b2b77bb"],
    },
    {
        "id": "cell_12",
        "chapter": "Nature's Treasures",
        "question": "What is the function of the large central vacuole in a mature plant cell?",
        "gold_chunk_ids": ["73065886-902f-53ea-babb-7af92b2b77bb"],
    },
    {
        "id": "cell_13",
        "chapter": "Nature's Treasures",
        "question": "What is the key difference between mitosis and meiosis in terms of the number and genetic content of the daughter cells produced?",
        "gold_chunk_ids": ["4dff39c2-eb6f-55b6-9d4a-b8f94cdf096e", "e8539bbd-5c1c-5102-809e-65ccd212a829"],
    },
    {
        "id": "cell_14",
        "chapter": "Nature's Treasures",
        "question": "In which cells of the human body does meiosis occur, and what gametes does it produce?",
        "gold_chunk_ids": ["e8539bbd-5c1c-5102-809e-65ccd212a829"],
    },
    {
        "id": "cell_15",
        "chapter": "Nature's Treasures",
        "question": "What is contact inhibition, and how do cancer cells differ from normal cells with respect to it?",
        "gold_chunk_ids": ["49554329-bc62-52a2-9019-b190336ab179"],
    },
    {
        "id": "cell_16",
        "chapter": "Nature's Treasures",
        "question": "True or False: Mature human red blood cells (RBCs) contain a nucleus, which allows them to repair and divide themselves.",
        "gold_chunk_ids": ["93c3e8ef-9de6-5bdd-8566-3bfd5c2744d7"],
    },
    {
        "id": "cell_17",
        "chapter": "Nature's Treasures",
        "question": "What is the main component of the plant cell wall, and what role does it play in the human diet?",
        "gold_chunk_ids": ["ec5888c1-bc55-5952-b040-18ab0f420753"],
    },
    {
        "id": "cell_18",
        "chapter": "Nature's Treasures",
        "question": "Using the method in Activity 2.1, if the diameter of the visible field under a microscope is 5000 micrometres and 25 cells are seen along the diameter, what is the estimated size of one cell?",
        "gold_chunk_ids": ["3593db30-412a-5eb6-9e68-885e7682dee3"],
    },
]

# Chapter: "Reproduction: How Life Continues" (Science, Class 9)

GOLD_QUESTIONS += [
    {
        "id": "repro_01",
        "chapter": "Reproduction: How Life Continues",
        "question": "What is vegetative propagation, and give two examples of plants mentioned in the chapter that reproduce this way.",
        "gold_chunk_ids": ["4a775fce-ec99-5e7e-b976-da0250a8f507"],
    },
    {
        "id": "repro_02",
        "chapter": "Reproduction: How Life Continues",
        "question": "What is grafting, and how is it performed?",
        "gold_chunk_ids": ["5738acdc-3029-5307-ae68-c775b808f732"],
    },
    {
        "id": "repro_03",
        "chapter": "Reproduction: How Life Continues",
        "question": "Why does asexual reproduction produce offspring (clones) that are genetically identical to the parent?",
        "gold_chunk_ids": ["4398e07b-a375-5ffa-9252-d9af688c27f9"],
    },
    {
        "id": "repro_04",
        "chapter": "Reproduction: How Life Continues",
        "question": "What is budding, and which organism mentioned in the chapter reproduces this way?",
        "gold_chunk_ids": ["1ab4f87d-ef94-58db-befe-03f04ea43858"],
    },
    {
        "id": "repro_05",
        "chapter": "Reproduction: How Life Continues",
        "question": "Why is meiosis necessary for gamete formation in sexual reproduction, rather than mitosis?",
        "gold_chunk_ids": ["4398e07b-a375-5ffa-9252-d9af688c27f9", "de59925c-60f7-5ac6-942a-6e50140b9bb3"],
    },
    {
        "id": "repro_06",
        "chapter": "Reproduction: How Life Continues",
        "question": "What are the four parts of a complete flower?",
        "gold_chunk_ids": ["46af5db4-c54f-5096-99c5-71d0b9044cf5"],
    },
    {
        "id": "repro_07",
        "chapter": "Reproduction: How Life Continues",
        "question": "What is pollination, and what is the difference between self-pollination and cross-pollination?",
        "gold_chunk_ids": ["90741865-a0b1-5732-a9a2-c1f343fe487a"],
    },
    {
        "id": "repro_08",
        "chapter": "Reproduction: How Life Continues",
        "question": "Which plants use wind pollination, and what features of their pollen and stigma make this effective?",
        "gold_chunk_ids": ["90741865-a0b1-5732-a9a2-c1f343fe487a"],
    },
    {
        "id": "repro_09",
        "chapter": "Reproduction: How Life Continues",
        "question": "What happens to the ovary and the ovules of a flower after fertilisation?",
        "gold_chunk_ids": ["90741865-a0b1-5732-a9a2-c1f343fe487a"],
    },
    {
        "id": "repro_10",
        "chapter": "Reproduction: How Life Continues",
        "question": "What is the difference between external fertilisation and internal fertilisation, and which animals mentioned in the chapter use each?",
        "gold_chunk_ids": ["67ea278a-6e52-5a00-8672-8788cde42934"],
    },
    {
        "id": "repro_11",
        "chapter": "Reproduction: How Life Continues",
        "question": "According to the chapter's data, how do wind-pollinated grasses and insect-pollinated plants compare in terms of pollen grains released per flower versus seeds formed?",
        "gold_chunk_ids": ["f31c39ea-5c7d-5574-ab44-d40f56674c28"],
    },
    {
        "id": "repro_12",
        "chapter": "Reproduction: How Life Continues",
        "question": "How many chromosomes do human sperm and egg cells have compared to normal body cells, and why is this important?",
        "gold_chunk_ids": ["13082afe-538e-5225-bdf3-fcfa1705c659"],
    },
    {
        "id": "repro_13",
        "chapter": "Reproduction: How Life Continues",
        "question": "What is ovulation, and around which day of the menstrual cycle does it typically occur?",
        "gold_chunk_ids": ["a0007e96-3bd4-5609-bea1-a702abab5a89"],
    },
    {
        "id": "repro_14",
        "chapter": "Reproduction: How Life Continues",
        "question": "What is menstruation, and how long does it usually last?",
        "gold_chunk_ids": ["a0007e96-3bd4-5609-bea1-a702abab5a89"],
    },
    {
        "id": "repro_15",
        "chapter": "Reproduction: How Life Continues",
        "question": "What determines the biological sex of a baby, according to the chapter?",
        "gold_chunk_ids": ["a0007e96-3bd4-5609-bea1-a702abab5a89"],
    },
    {
        "id": "repro_16",
        "chapter": "Reproduction: How Life Continues",
        "question": "What are the three trimesters of human pregnancy, and approximately how long does pregnancy last?",
        "gold_chunk_ids": ["d9cd2b1f-37fb-526d-bca4-2477ad0e42e6"],
    },
    {
        "id": "repro_17",
        "chapter": "Reproduction: How Life Continues",
        "question": "Who pioneered India's first test tube baby through IVF, in which year, and what was the baby's name?",
        "gold_chunk_ids": ["13082afe-538e-5225-bdf3-fcfa1705c659"],
    },
    {
        "id": "repro_18",
        "chapter": "Reproduction: How Life Continues",
        "question": "True or False: In humans, egg cells are produced in millions, similar to sperm cells.",
        "gold_chunk_ids": ["13082afe-538e-5225-bdf3-fcfa1705c659"],
    },
]

# Chapter: "Tissues in Action" (Science, Class 9)

GOLD_QUESTIONS += [
    {
        "id": "tissue_01",
        "chapter": "Tissues in Action",
        "question": "What is a tissue?",
        "gold_chunk_ids": ["e630a6bf-1471-529d-82b8-43c4779f9ac8"],
    },
    {
        "id": "tissue_02",
        "chapter": "Tissues in Action",
        "question": "What are the three types of meristematic tissues in plants, and what growth does each control?",
        "gold_chunk_ids": ["d6648ef2-8295-5b48-b0b6-e804209b1458"],
    },
    {
        "id": "tissue_03",
        "chapter": "Tissues in Action",
        "question": "How does the lateral meristem cause an increase in the girth of a plant stem?",
        "gold_chunk_ids": ["d6648ef2-8295-5b48-b0b6-e804209b1458"],
    },
    {
        "id": "tissue_04",
        "chapter": "Tissues in Action",
        "question": "Who demonstrated in 1958 that single cells from carrot phloem could regenerate a whole plant, and what is this ability called?",
        "gold_chunk_ids": ["b24be278-6d13-5a7b-adcf-439b87ef95e8"],
    },
    {
        "id": "tissue_05",
        "chapter": "Tissues in Action",
        "question": "What are the three simple permanent tissues in plants, and what does each do?",
        "gold_chunk_ids": ["e0ad09f5-30e5-5cdb-b4bb-a393879acd84"],
    },
    {
        "id": "tissue_06",
        "chapter": "Tissues in Action",
        "question": "What is xylem, and what does it transport in a plant?",
        "gold_chunk_ids": ["71bd69c2-9d6c-5ef4-a219-bec7a6518c88"],
    },
    {
        "id": "tissue_07",
        "chapter": "Tissues in Action",
        "question": "What is phloem, and what does it transport in a plant?",
        "gold_chunk_ids": ["71bd69c2-9d6c-5ef4-a219-bec7a6518c88"],
    },
    {
        "id": "tissue_08",
        "chapter": "Tissues in Action",
        "question": "What are the three tissue systems into which plant tissues are organised?",
        "gold_chunk_ids": ["33044059-4ffc-512e-a1a5-880e365d54df"],
    },
    {
        "id": "tissue_09",
        "chapter": "Tissues in Action",
        "question": "What are the four functional types of epithelial tissue described in the chapter, with an example location for each?",
        "gold_chunk_ids": ["396dd33d-47b4-5904-8fad-db866e1e1811"],
    },
    {
        "id": "tissue_10",
        "chapter": "Tissues in Action",
        "question": "Blood and bone are both classified as connective tissue. What key difference between them explains why one is fluid and the other is hard?",
        "gold_chunk_ids": ["396dd33d-47b4-5904-8fad-db866e1e1811"],
    },
    {
        "id": "tissue_11",
        "chapter": "Tissues in Action",
        "question": "What are the four connective tissues described through Activity 3.3, and what does each do?",
        "gold_chunk_ids": ["dd4fa97d-6e5c-5425-8610-4920602b8ae4"],
    },
    {
        "id": "tissue_12",
        "chapter": "Tissues in Action",
        "question": "What is the difference between voluntary and involuntary movements, and which muscle types are responsible for each?",
        "gold_chunk_ids": ["dd4fa97d-6e5c-5425-8610-4920602b8ae4", "895cc6c7-9d85-5886-a77a-8c01fa18625d"],
    },
    {
        "id": "tissue_13",
        "chapter": "Tissues in Action",
        "question": "What are the three main parts of a neuron?",
        "gold_chunk_ids": ["895cc6c7-9d85-5886-a77a-8c01fa18625d"],
    },
    {
        "id": "tissue_14",
        "chapter": "Tissues in Action",
        "question": "What are the four types of joints described in the chapter, and give an example location for each?",
        "gold_chunk_ids": ["3f59f63e-a047-5365-b2f0-ffe9d09dd294"],
    },
    {
        "id": "tissue_15",
        "chapter": "Tissues in Action",
        "question": "According to the teak tree growth data table in the chapter, what is the relationship between the diameter of the tree stem and the number of annual rings formed?",
        "gold_chunk_ids": ["574b9c13-52f7-5df5-b37a-650be043cf41"],
    },
    {
        "id": "tissue_16",
        "chapter": "Tissues in Action",
        "question": "What causes crown gall disease in plants, and how has this knowledge been applied in agriculture?",
        "gold_chunk_ids": ["b35d25bf-415c-5fcf-9dfb-222148914409"],
    },
    {
        "id": "tissue_17",
        "chapter": "Tissues in Action",
        "question": "On average, what percentage of an adult human's body weight comes from bones?",
        "gold_chunk_ids": ["895cc6c7-9d85-5886-a77a-8c01fa18625d"],
    },
    {
        "id": "tissue_18",
        "chapter": "Tissues in Action",
        "question": "True or False: Meristematic cells typically have large vacuoles that help them divide rapidly.",
        "gold_chunk_ids": ["d6648ef2-8295-5b48-b0b6-e804209b1458"],
    },
]

# Chapter: "Exploration: Entering the World of Secondary Science" (Science,
# Class 9) — a short intro chapter about the nature of science itself
# (models, laws/theories, estimation, units), 7 chunks, fewer questions
# than other chapters given its length.

GOLD_QUESTIONS += [
    {
        "id": "intro_01",
        "chapter": "Exploration: Entering the World of Secondary Science",
        "question": "What is the difference between a scientific law, a theory, and a principle, as described in the chapter?",
        "gold_chunk_ids": ["9f0a2e5b-3962-5e42-9cb2-20f46b586d4b"],
    },
    {
        "id": "intro_02",
        "chapter": "Exploration: Entering the World of Secondary Science",
        "question": "Why is the speed of light denoted by the symbol 'c'?",
        "gold_chunk_ids": ["9f0a2e5b-3962-5e42-9cb2-20f46b586d4b"],
    },
    {
        "id": "intro_03",
        "chapter": "Exploration: Entering the World of Secondary Science",
        "question": "What is the exact defined value of the speed of light in metres per second?",
        "gold_chunk_ids": ["9f0a2e5b-3962-5e42-9cb2-20f46b586d4b"],
    },
    {
        "id": "intro_04",
        "chapter": "Exploration: Entering the World of Secondary Science",
        "question": "What is a scientific model, and why do scientists deliberately ignore certain details when building one?",
        "gold_chunk_ids": ["773c9818-14ee-59f0-b6f9-904ce98cc32c"],
    },
    {
        "id": "intro_05",
        "chapter": "Exploration: Entering the World of Secondary Science",
        "question": "In the airplane fuel miscalculation example described in the chapter, what caused the aircraft to run out of fuel mid-flight?",
        "gold_chunk_ids": ["9f0a2e5b-3962-5e42-9cb2-20f46b586d4b"],
    },
    {
        "id": "intro_06",
        "chapter": "Exploration: Entering the World of Secondary Science",
        "question": "According to the chapter's estimation example, roughly how many litres of air does a person breathe in one day?",
        "gold_chunk_ids": ["84125595-a133-51c4-ad25-b8c6fa56957d"],
    },
    {
        "id": "intro_07",
        "chapter": "Exploration: Entering the World of Secondary Science",
        "question": "Which Indian scientist simplified the study of starlight by treating stellar matter as a hot gas, and what did this help him explain?",
        "gold_chunk_ids": ["773c9818-14ee-59f0-b6f9-904ce98cc32c"],
    },
    {
        "id": "intro_08",
        "chapter": "Exploration: Entering the World of Secondary Science",
        "question": "According to the chapter, why are scientific theories never considered 'final' or 'beyond question'?",
        "gold_chunk_ids": ["7fae2ab4-39e8-50d8-9ca4-d6b35c6e1276"],
    },
    {
        "id": "intro_09",
        "chapter": "Exploration: Entering the World of Secondary Science",
        "question": "True or False: According to the chapter, eating food during an eclipse becomes harmful due to a physical or chemical change caused by the eclipse.",
        "gold_chunk_ids": ["7fae2ab4-39e8-50d8-9ca4-d6b35c6e1276"],
    },
    {
        "id": "intro_10",
        "chapter": "Exploration: Entering the World of Secondary Science",
        "question": "What two symbols frame the page numbers in this textbook, and what does each represent?",
        "gold_chunk_ids": ["50df323b-65dd-582f-bcd5-137d6db5aae6"],
    },
    {
        "id": "intro_11",
        "chapter": "Exploration: Entering the World of Secondary Science",
        "question": "What is the value of learning to make rough estimates in science, rather than always calculating exact values?",
        "gold_chunk_ids": ["7fae2ab4-39e8-50d8-9ca4-d6b35c6e1276"],
    },
]
