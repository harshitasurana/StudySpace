# -*- coding: utf-8 -*-
# Gold question set for the NCERT-RAG-Eval-style benchmark, built against
# the REAL local RAGProductionApp corpus (Qdrant "docs" collection).
# Each question is hand-written from actually reading the source chunk text
# (not synthetic/templated), with gold chunk id(s) recorded exactly as they
# exist in the corpus_cache/all_chunks.jsonl snapshot today.
#
# Subject: Social Studies (Grade 9, "Understanding Society: India and Beyond").
# Covers all 9 Social Studies chapters.

GOLD_QUESTIONS = []

# Chapter: "Understanding Social Science"

GOLD_QUESTIONS += [
    {
        "id": "socsci_01",
        "chapter": "Understanding Social Science",
        "question": "What are the four core disciplines from which Social Science primarily draws, according to the chapter?",
        "gold_chunk_ids": ["5ee3f302-5f27-55d6-a7ed-61004de3aea3"],
    },
    {
        "id": "socsci_02",
        "chapter": "Understanding Social Science",
        "question": "What does Geography study, and what tools does it use to investigate its questions?",
        "gold_chunk_ids": ["8f3be3b9-9db7-574d-bb2c-28237ed70fb5"],
    },
    {
        "id": "socsci_03",
        "chapter": "Understanding Social Science",
        "question": "What is History the study of, and what does modern historiography increasingly rely on to establish timelines?",
        "gold_chunk_ids": ["d63cab89-bdf4-57b9-ba37-077b272285b1"],
    },
    {
        "id": "socsci_04",
        "chapter": "Understanding Social Science",
        "question": "What is Political Science the study of, according to the chapter?",
        "gold_chunk_ids": ["abddabd7-6098-559c-b62d-47da00f8fe68"],
    },
    {
        "id": "socsci_05",
        "chapter": "Understanding Social Science",
        "question": "What does Economics help us understand, and what decision-making roles does it study?",
        "gold_chunk_ids": ["6e785d61-4b63-5d2c-a2e1-7de8e5fa3a11"],
    },
    {
        "id": "socsci_06",
        "chapter": "Understanding Social Science",
        "question": "Which ancient Indian ideas were closely linked to the early study of politics, and which text is described as a foundational treatise on politics and administration?",
        "gold_chunk_ids": ["2833b2f4-c260-5c38-8013-0be95b121601"],
    },
    {
        "id": "socsci_07",
        "chapter": "Understanding Social Science",
        "question": "What is the concept of the Panchamahabhutas, and what five fundamental elements does it comprise?",
        "gold_chunk_ids": ["d3c1efca-0776-5f03-adc2-e61b17971533", "f01402c1-72aa-50dc-9cf3-559ec268e540"],
    },
    {
        "id": "socsci_08",
        "chapter": "Understanding Social Science",
        "question": "What does the phrase 'vasudhaiva kutumbakam' mean, and what idea does it express?",
        "gold_chunk_ids": ["d3c1efca-0776-5f03-adc2-e61b17971533"],
    },
    {
        "id": "socsci_09",
        "chapter": "Understanding Social Science",
        "question": "In simple words, how does the chapter define Social Science, and how does it differ from subjects like Physics, Chemistry, and Biology?",
        "gold_chunk_ids": ["c634aaf1-da2c-54e7-9b06-4327bea1f325"],
    },
    {
        "id": "socsci_10",
        "chapter": "Understanding Social Science",
        "question": "What are archaeological sources and epigraphic sources, and give an example of each mentioned in the chapter's figures.",
        "gold_chunk_ids": ["adf6779b-0347-574d-94fa-115b6941f659", "d0ff9da0-828b-5d10-a4fa-48f5eee29c39"],
    },
    {
        "id": "socsci_11",
        "chapter": "Understanding Social Science",
        "question": "Why is Social Science described as connecting the past, present, and future?",
        "gold_chunk_ids": ["b3ec4e8e-e2a6-57a2-bb8e-d034ecc6d001", "ca6ee36a-2228-5192-8195-504543daee49"],
    },
    {
        "id": "socsci_12",
        "chapter": "Understanding Social Science",
        "question": "What broad areas will students explore over the two-year Grade 9-10 Social Science learning journey, according to the chapter?",
        "gold_chunk_ids": ["d42647e9-8848-588a-996d-178fd5daa272"],
    },
]

# Chapter: "Shaping of the Earth's Surface"

GOLD_QUESTIONS += [
    {
        "id": "earthsurf_01",
        "chapter": "Shaping of the Earth's Surface",
        "question": "What is the theory of plate tectonics, and who proposed it?",
        "gold_chunk_ids": ["c6b7ca3b-2724-596e-a23a-9a46a3cf35e5", "e8fb7587-2a29-543c-9049-7fc332ee2a8c"],
    },
    {
        "id": "earthsurf_03",
        "chapter": "Shaping of the Earth's Surface",
        "question": "What is the lithosphere, and what is the asthenosphere?",
        "gold_chunk_ids": ["b61e6ad0-d61b-51db-a79a-70f37ab27f32"],
    },
    {
        "id": "earthsurf_04",
        "chapter": "Shaping of the Earth's Surface",
        "question": "According to the chapter, what is the approximate thickness of the Earth's crust under continents compared to under the ocean?",
        "gold_chunk_ids": ["b61e6ad0-d61b-51db-a79a-70f37ab27f32"],
    },
    {
        "id": "earthsurf_05",
        "chapter": "Shaping of the Earth's Surface",
        "question": "What causes the movement of tectonic plates?",
        "gold_chunk_ids": ["e3205630-f319-5d83-b312-70fc691a59d0"],
    },
    {
        "id": "earthsurf_06",
        "chapter": "Shaping of the Earth's Surface",
        "question": "What are the three main types of plate boundaries, and what landform or feature is given as an example for each?",
        "gold_chunk_ids": ["e3205630-f319-5d83-b312-70fc691a59d0"],
    },
    {
        "id": "earthsurf_07",
        "chapter": "Shaping of the Earth's Surface",
        "question": "What is the key difference between weathering and erosion?",
        "gold_chunk_ids": ["ed24d869-9615-52ca-8cd8-a64b3b8a34de"],
    },
    {
        "id": "earthsurf_09",
        "chapter": "Shaping of the Earth's Surface",
        "question": "What is a meander, and how is it formed?",
        "gold_chunk_ids": ["8aa4d7dc-3cb0-52a1-bb8c-beb07619818b"],
    },
    {
        "id": "earthsurf_10",
        "chapter": "Shaping of the Earth's Surface",
        "question": "What is a delta, and why are deltas highly fertile and important for human settlement?",
        "gold_chunk_ids": ["34805042-da63-5dad-8e1d-263852da7b00"],
    },
    {
        "id": "earthsurf_11",
        "chapter": "Shaping of the Earth's Surface",
        "question": "What are moraines, and what are the three types described in the chapter?",
        "gold_chunk_ids": ["0932586b-64d5-566d-9714-1c4ad7264c97"],
    },
    {
        "id": "earthsurf_13",
        "chapter": "Shaping of the Earth's Surface",
        "question": "What is Karst topography, and what landforms of underground water does it include?",
        "gold_chunk_ids": ["618131f0-a33a-5017-b541-6c132c13c17a"],
    },
    {
        "id": "earthsurf_14",
        "chapter": "Shaping of the Earth's Surface",
        "question": "What are the different types of sand dunes described in the chapter?",
        "gold_chunk_ids": ["e15db258-cd14-5aa3-b063-f7f965071bd6"],
    },
    {
        "id": "earthsurf_15",
        "chapter": "Shaping of the Earth's Surface",
        "question": "What landforms are created by coastal erosion?",
        "gold_chunk_ids": ["eb9a8d3b-f43f-548b-b370-c713d558bd9c"],
    },
    {
        "id": "earthsurf_16",
        "chapter": "Shaping of the Earth's Surface",
        "question": "Which ancient Indian text contains detailed guidelines on land assessment for water management, and what is the Zabo system in Nagaland?",
        "gold_chunk_ids": ["28a7a75f-5b77-5764-af64-6925f04623b4", "b2527395-4e4c-5789-801b-7f9c47ee046c"],
    },
    {
        "id": "earthsurf_17",
        "chapter": "Shaping of the Earth's Surface",
        "question": "In early Indian tradition, what were earthquakes called, and which scholar and text discussed the elemental forces attributed to them?",
        "gold_chunk_ids": ["049fe1c3-1486-5161-b71a-330b2c2ac17f"],
    },
    {
        "id": "earthsurf_18",
        "chapter": "Shaping of the Earth's Surface",
        "question": "What is a Glacial Lake Outburst Flood (GLOF), and what typically causes it?",
        "gold_chunk_ids": ["fd8e4994-96be-586a-a572-2ce08114fc48"],
    },
    {
        "id": "earthsurf_19",
        "chapter": "Shaping of the Earth's Surface",
        "question": "In which year and month did a devastating flood strike Chamoli district in Uttarakhand, as mentioned in the chapter?",
        "gold_chunk_ids": ["6a13a0b3-9150-5f37-b2c0-376058e75283"],
    },
    {
        "id": "earthsurf_21",
        "chapter": "Shaping of the Earth's Surface",
        "question": "What conditions make dust storms more likely to occur, according to the chapter?",
        "gold_chunk_ids": ["b798f23c-92c2-5da3-96c0-c30880718066"],
    },
    {
        "id": "earthsurf_22",
        "chapter": "Shaping of the Earth's Surface",
        "question": "What factors can trigger avalanches, according to the chapter?",
        "gold_chunk_ids": ["ca4493bc-2cb5-5ea4-862c-d977a6ee23e2"],
    },
    {
        "id": "earthsurf_24",
        "chapter": "Shaping of the Earth's Surface",
        "question": "How did landforms such as the Himalayas, the Thar desert, and coasts shape the history of human civilisations in India, according to the chapter?",
        "gold_chunk_ids": ["cc58e3f9-b9b9-5b67-bc06-8a74b0bfc78d"],
    },
]

# Chapter: "Atmosphere and Climate"

GOLD_QUESTIONS += [
    {
        "id": "atmosphere_01",
        "chapter": "Atmosphere and Climate",
        "question": "What are the two most abundant gases in the Earth's atmosphere, and what percentage does each make up?",
        "gold_chunk_ids": ["29dd5719-7153-54d4-a947-1c035795b103"],
    },
    {
        "id": "atmosphere_02",
        "chapter": "Atmosphere and Climate",
        "question": "What is the typical range of water vapour content in the atmosphere, and what role does it play?",
        "gold_chunk_ids": ["29dd5719-7153-54d4-a947-1c035795b103"],
    },
    {
        "id": "atmosphere_03",
        "chapter": "Atmosphere and Climate",
        "question": "Which layer of the atmosphere contains the air we breathe and is where nearly all weather phenomena, such as rainfall, fog, and hail, occur?",
        "gold_chunk_ids": ["81f23f3f-8779-50fa-95f6-2d975eaadea5"],
    },
    {
        "id": "atmosphere_04",
        "chapter": "Atmosphere and Climate",
        "question": "What does the Stratosphere contain that shields us from harmful solar radiation, and why is it ideal for flying aeroplanes?",
        "gold_chunk_ids": ["cc48230a-8944-5113-9b6b-9da9bb5bf985"],
    },
    {
        "id": "atmosphere_07",
        "chapter": "Atmosphere and Climate",
        "question": "Why does temperature rise very rapidly with increasing altitude in the Thermosphere?",
        "gold_chunk_ids": ["cc48230a-8944-5113-9b6b-9da9bb5bf985"],
    },
    {
        "id": "atmosphere_09",
        "chapter": "Atmosphere and Climate",
        "question": "What is the difference between weather and climate, according to the chapter?",
        "gold_chunk_ids": ["2b908319-4ce8-5c7f-8732-5ac8c99cfeac"],
    },
    {
        "id": "atmosphere_10",
        "chapter": "Atmosphere and Climate",
        "question": "What are the major elements of weather and climate that impact human life, as listed in the chapter?",
        "gold_chunk_ids": ["2b908319-4ce8-5c7f-8732-5ac8c99cfeac"],
    },
    {
        "id": "atmosphere_12",
        "chapter": "Atmosphere and Climate",
        "question": "Why does temperature generally decrease from the equator towards the poles?",
        "gold_chunk_ids": ["f270cf3f-5529-54a0-8b28-6bbb766707bf"],
    },
    {
        "id": "atmosphere_13",
        "chapter": "Atmosphere and Climate",
        "question": "What is humidity, and how does warmer air affect its capacity to hold water vapour?",
        "gold_chunk_ids": ["f270cf3f-5529-54a0-8b28-6bbb766707bf", "86c05a3a-e827-5735-8870-62269274fe61"],
    },
    {
        "id": "atmosphere_14",
        "chapter": "Atmosphere and Climate",
        "question": "What is precipitation, and what forms can it take according to the chapter?",
        "gold_chunk_ids": ["f270cf3f-5529-54a0-8b28-6bbb766707bf"],
    },
    {
        "id": "atmosphere_15",
        "chapter": "Atmosphere and Climate",
        "question": "What is atmospheric pressure, and how does it change with altitude?",
        "gold_chunk_ids": ["a2b16d5d-f3b2-5505-917f-77b7e11334af"],
    },
    {
        "id": "atmosphere_18",
        "chapter": "Atmosphere and Climate",
        "question": "What is a land breeze, and why does it occur at night?",
        "gold_chunk_ids": ["674ae412-ed28-54c0-9b01-3435994d01c7"],
    },
    {
        "id": "atmosphere_20",
        "chapter": "Atmosphere and Climate",
        "question": "What are the four distinct seasons of India recognised by the Indian Meteorological Department (IMD)?",
        "gold_chunk_ids": ["096b43d8-5be2-59ef-b4ed-9746b5a02e31"],
    },
    {
        "id": "atmosphere_21",
        "chapter": "Atmosphere and Climate",
        "question": "According to the traditional Indian calendar, how many seasons does India experience, and what are they based on?",
        "gold_chunk_ids": ["13c0d896-4788-5f7e-b029-b70a5b0791af"],
    },
    {
        "id": "atmosphere_22",
        "chapter": "Atmosphere and Climate",
        "question": "Which ancient Indian text is noted for containing scientific measurements of rainfall used for revenue and relief efforts?",
        "gold_chunk_ids": ["13c0d896-4788-5f7e-b029-b70a5b0791af"],
    },
    {
        "id": "atmosphere_23",
        "chapter": "Atmosphere and Climate",
        "question": "What is the origin of the word 'monsoon', and who were among the first to notice the monsoon phenomenon?",
        "gold_chunk_ids": ["ac415dd5-9d26-58c9-bbb1-285819902f9e"],
    },
    {
        "id": "atmosphere_24",
        "chapter": "Atmosphere and Climate",
        "question": "What causes the southwest (summer) monsoon in India, and between which months does it typically occur?",
        "gold_chunk_ids": ["71dca5b9-60a0-5986-91f5-e64e2f5aafd9", "ac415dd5-9d26-58c9-bbb1-285819902f9e"],
    },
    {
        "id": "atmosphere_25",
        "chapter": "Atmosphere and Climate",
        "question": "What is the northeast (winter) monsoon, and between which months does it occur in India?",
        "gold_chunk_ids": ["ac415dd5-9d26-58c9-bbb1-285819902f9e", "e4066a58-d135-520e-b971-80e487596e8c"],
    },
    {
        "id": "atmosphere_27",
        "chapter": "Atmosphere and Climate",
        "question": "What is the National Monsoon Mission (NMM), and which ministry developed it?",
        "gold_chunk_ids": ["e4066a58-d135-520e-b971-80e487596e8c"],
    },
    {
        "id": "atmosphere_28",
        "chapter": "Atmosphere and Climate",
        "question": "According to the chapter's climate data table (Table 3.3), what is the annual rainfall recorded at Mumbai, and how does it compare to Delhi's annual rainfall?",
        "gold_chunk_ids": ["999e3354-3838-5db9-97f6-fc07cc84a190"],
    },
    {
        "id": "atmosphere_31",
        "chapter": "Atmosphere and Climate",
        "question": "What were the main natural causes of the 2025 Punjab floods described in the chapter's case study?",
        "gold_chunk_ids": ["b5381e31-abda-587f-9e73-46618324a0a3"],
    },
    {
        "id": "atmosphere_32",
        "chapter": "Atmosphere and Climate",
        "question": "What human-made factors aggravated the 2025 Punjab floods, according to the chapter?",
        "gold_chunk_ids": ["b5381e31-abda-587f-9e73-46618324a0a3"],
    },
    {
        "id": "atmosphere_34",
        "chapter": "Atmosphere and Climate",
        "question": "What is a carbon footprint, according to the chapter's glossary?",
        "gold_chunk_ids": ["07e09907-cb2d-518e-ab43-7d507a548910"],
    },
    {
        "id": "atmosphere_35",
        "chapter": "Atmosphere and Climate",
        "question": "What is climate change, and what human activities does the chapter identify as its main causes?",
        "gold_chunk_ids": ["7f317c6e-55aa-5c9d-b5c1-c903e8d701a4"],
    },
]

# Chapter: "Early Humans and Beginning of Civilisation"

GOLD_QUESTIONS += [
    {
        "id": "earlyhumans_01",
        "chapter": "Early Humans and Beginning of Civilisation",
        "question": "What is the key difference between 'biological evolution' and 'cultural evolution' as defined in the chapter?",
        "gold_chunk_ids": ["022ab8e3-09aa-51d3-94f4-2da62e278d84"],
    },
    {
        "id": "earlyhumans_02",
        "chapter": "Early Humans and Beginning of Civilisation",
        "question": "According to the chapter's comparison table, what proportion of human history falls under the period before writing was invented?",
        "gold_chunk_ids": ["022ab8e3-09aa-51d3-94f4-2da62e278d84"],
    },
    {
        "id": "earlyhumans_03",
        "chapter": "Early Humans and Beginning of Civilisation",
        "question": "What are 'hominins', and around when did an early human ancestor make the earliest stone tools?",
        "gold_chunk_ids": ["8f958757-9021-5861-b476-00e341812fca"],
    },
    {
        "id": "earlyhumans_04",
        "chapter": "Early Humans and Beginning of Civilisation",
        "question": "Which early human ancestor was the first hominin to exit Africa, and what stone tools did it make?",
        "gold_chunk_ids": ["e975e77a-31fd-574d-b6cb-e03305134b7d"],
    },
    {
        "id": "earlyhumans_05",
        "chapter": "Early Humans and Beginning of Civilisation",
        "question": "Where did Homo habilis live, and what tools did this early human ancestor make?",
        "gold_chunk_ids": ["ddd8b928-1697-5a74-b987-2b270b2d15b9", "a48f488b-911a-5737-bb12-85d61cd34248"],
    },
    {
        "id": "earlyhumans_07",
        "chapter": "Early Humans and Beginning of Civilisation",
        "question": "In the Indian subcontinent, approximately how old is the oldest human settlement, and which two sites are given dates in the chapter?",
        "gold_chunk_ids": ["0b370118-2f57-53ea-9eec-3e49f87dad32", "71d55422-7847-5ac3-8488-f795c4a9b8bb"],
    },
    {
        "id": "earlyhumans_08",
        "chapter": "Early Humans and Beginning of Civilisation",
        "question": "What tools were used by Palaeolithic hunter-gatherers to chop meat, dig tubers, and scrape animal skin?",
        "gold_chunk_ids": ["fc4aa439-90ba-59ed-8841-ea198e4b4199"],
    },
    {
        "id": "earlyhumans_09",
        "chapter": "Early Humans and Beginning of Civilisation",
        "question": "What environmental changes led to the first-ever population explosion in human history during the Mesolithic period?",
        "gold_chunk_ids": ["06b04113-7243-5677-a1d1-ae2d68bc218e"],
    },
    {
        "id": "earlyhumans_10",
        "chapter": "Early Humans and Beginning of Civilisation",
        "question": "What is the World Heritage Site of Bhimbetka known for, according to the chapter?",
        "gold_chunk_ids": ["06b04113-7243-5677-a1d1-ae2d68bc218e"],
    },
    {
        "id": "earlyhumans_11",
        "chapter": "Early Humans and Beginning of Civilisation",
        "question": "What was the hallmark of the Neolithic Revolution, and how did Neolithic farmers' tools differ from those of hunter-gatherers?",
        "gold_chunk_ids": ["54519857-f30a-51dd-af41-ed7ec1012ae8"],
    },
    {
        "id": "earlyhumans_12",
        "chapter": "Early Humans and Beginning of Civilisation",
        "question": "What is Mehrgarh, and approximately when was it established as the earliest agricultural village in the Indian subcontinent?",
        "gold_chunk_ids": ["08bd7a70-9553-5100-8ef5-01e51ac1c6bd"],
    },
    {
        "id": "earlyhumans_13",
        "chapter": "Early Humans and Beginning of Civilisation",
        "question": "What four early world civilisations emerged in river plains, according to the chapter, and along which rivers?",
        "gold_chunk_ids": ["5e8605a3-8059-528b-a308-04009fc5242a"],
    },
    {
        "id": "earlyhumans_14",
        "chapter": "Early Humans and Beginning of Civilisation",
        "question": "What does the name 'Mesopotamia' mean, and which two rivers drain the region known as the 'fertile crescent'?",
        "gold_chunk_ids": ["5e8605a3-8059-528b-a308-04009fc5242a"],
    },
    {
        "id": "earlyhumans_15",
        "chapter": "Early Humans and Beginning of Civilisation",
        "question": "What were the four major city-based civilisations that flourished in Mesopotamia from around 3500 BCE onwards?",
        "gold_chunk_ids": ["3e68550d-a815-53e8-949e-c6f642483a54"],
    },
    {
        "id": "earlyhumans_16",
        "chapter": "Early Humans and Beginning of Civilisation",
        "question": "What was a ziggurat, and what role did it play in Sumerian cities?",
        "gold_chunk_ids": ["3e68550d-a815-53e8-949e-c6f642483a54", "54e805ca-233c-5b6f-9be3-82beb3206231"],
    },
    {
        "id": "earlyhumans_17",
        "chapter": "Early Humans and Beginning of Civilisation",
        "question": "Who was Hammurabi, and what was his most significant contribution to Babylonian civilisation?",
        "gold_chunk_ids": ["4865b3e6-f9c0-557b-88b7-f38b394b2536", "c89de48b-8e7a-53ad-b0f4-5d1738ea8f5f"],
    },
    {
        "id": "earlyhumans_18",
        "chapter": "Early Humans and Beginning of Civilisation",
        "question": "What is cuneiform, and which civilisation is credited with developing it?",
        "gold_chunk_ids": ["8d704c27-a819-52ae-869a-4adee7a215a1", "9636c90c-5c8c-576c-90ff-424c70d6b381"],
    },
    {
        "id": "earlyhumans_20",
        "chapter": "Early Humans and Beginning of Civilisation",
        "question": "How was the Rosetta Stone significant for deciphering the Egyptian script, and who finally deciphered it?",
        "gold_chunk_ids": ["3062e45b-a389-512c-b5d8-310a02e90c17"],
    },
    {
        "id": "earlyhumans_21",
        "chapter": "Early Humans and Beginning of Civilisation",
        "question": "Why did the Egyptians refer to their land as 'Kemet', and what does the word mean?",
        "gold_chunk_ids": ["3f5ea51e-f263-596d-aa50-5a4cd8b673bf"],
    },
    {
        "id": "earlyhumans_23",
        "chapter": "Early Humans and Beginning of Civilisation",
        "question": "Why were Egyptian pyramids built, according to the chapter, and what process was used to preserve the body?",
        "gold_chunk_ids": ["641b868a-b9b4-523a-bafb-36fcf9d713cf"],
    },
    {
        "id": "earlyhumans_24",
        "chapter": "Early Humans and Beginning of Civilisation",
        "question": "Which two rivers were centres of early Chinese Neolithic cultures, and around when did urban centres begin to emerge in China?",
        "gold_chunk_ids": ["95c8b01a-bc50-5c65-8301-0625fbb220f1"],
    },
    {
        "id": "earlyhumans_25",
        "chapter": "Early Humans and Beginning of Civilisation",
        "question": "What was the earliest source of information about early Chinese civilisation, based on oracle bones?",
        "gold_chunk_ids": ["71287e57-d6f0-5f62-a3dd-40d0e4edc1af"],
    },
    {
        "id": "earlyhumans_26",
        "chapter": "Early Humans and Beginning of Civilisation",
        "question": "Around which century CE did silk become a major item of external trade during the Han dynasty, leading to the naming of the 'Silk Route'?",
        "gold_chunk_ids": ["32c1e2eb-8e54-5607-ba2d-3792b0805ea4"],
    },
    {
        "id": "earlyhumans_27",
        "chapter": "Early Humans and Beginning of Civilisation",
        "question": "What innovations is China credited with being the first country to introduce, according to the chapter's 'Don't Miss Out' note?",
        "gold_chunk_ids": ["32c1e2eb-8e54-5607-ba2d-3792b0805ea4"],
    },
]

# Chapter: "State and Society up to 1000 CE"

GOLD_QUESTIONS += [
    {
        "id": "statesociety_01",
        "chapter": "State and Society up to 1000 CE",
        "question": "How does the chapter define a 'society' as distinct from a 'State'?",
        "gold_chunk_ids": ["5d63327e-36fa-5a9f-8ea2-b915c2711120"],
    },
    {
        "id": "statesociety_02",
        "chapter": "State and Society up to 1000 CE",
        "question": "What does the Rig Veda's mention of about thirty 'janas' tell us, and which five janas were collectively known as the pañchajana?",
        "gold_chunk_ids": ["046f7fd2-b627-5b2d-9f7b-df1c3194d575", "0f05a162-ad31-508d-a09a-32d8f4f2096f"],
    },
    {
        "id": "statesociety_03",
        "chapter": "State and Society up to 1000 CE",
        "question": "What were the three assemblies mentioned in the Rig Veda and Atharva Veda during the Vedic period, and what was the function of each?",
        "gold_chunk_ids": ["0f05a162-ad31-508d-a09a-32d8f4f2096f", "3cfa630a-92d7-571d-b666-8f10c73d119c"],
    },
    {
        "id": "statesociety_04",
        "chapter": "State and Society up to 1000 CE",
        "question": "What are the four Vedas, and what does each primarily contain?",
        "gold_chunk_ids": ["3f604dd3-9031-53a7-b57e-a1dc2f591d27", "f2ba7d80-1d4a-5a21-931c-880b32b5de30"],
    },
    {
        "id": "statesociety_06",
        "chapter": "State and Society up to 1000 CE",
        "question": "What does the term 'janapada' literally mean, and what transition in identity does it indicate?",
        "gold_chunk_ids": ["b03641f5-7d9a-5085-82d6-9c15137c89ba", "6490700d-8a61-5264-95c8-3956ea5c4430"],
    },
    {
        "id": "statesociety_07",
        "chapter": "State and Society up to 1000 CE",
        "question": "How many mahajanapadas do historical sources usually speak of, and which one gradually emerged as the most powerful?",
        "gold_chunk_ids": ["6490700d-8a61-5264-95c8-3956ea5c4430", "e32e2df7-f7cf-5726-a859-2b51c3c80c1d"],
    },
    {
        "id": "statesociety_09",
        "chapter": "State and Society up to 1000 CE",
        "question": "What were the royal emblems of the Cholas, Cheras, and Pandyas, and what literary tradition is much of our knowledge of these early Tamil kingdoms based on?",
        "gold_chunk_ids": ["095aacec-d82f-5b03-8115-5a95fdcbbaa7", "67d3c03a-f328-5497-a440-8fe80a26ad6c"],
    },
    {
        "id": "statesociety_10",
        "chapter": "State and Society up to 1000 CE",
        "question": "What titles did early Indian rulers come to be known by from the 6th century BCE onwards, and what does the Arthashastra say about an energetically active king?",
        "gold_chunk_ids": ["3e83524f-8098-59d8-9198-08e2d13b9e2e"],
    },
    {
        "id": "statesociety_11",
        "chapter": "State and Society up to 1000 CE",
        "question": "What were the seven constituents of the state (Saptanga) identified by Kautilya in the Arthashastra?",
        "gold_chunk_ids": ["5f6b98bf-cc2b-512e-9d92-49663c1fe3ac", "c84322bd-8ed7-5837-a564-d733fcd483af"],
    },
    {
        "id": "statesociety_12",
        "chapter": "State and Society up to 1000 CE",
        "question": "What did the council of ministers (mantri-parishad) generally include during the Mauryan period, and what did an Ashokan inscription reveal about its role?",
        "gold_chunk_ids": ["c84322bd-8ed7-5837-a564-d733fcd483af"],
    },
    {
        "id": "statesociety_13",
        "chapter": "State and Society up to 1000 CE",
        "question": "What new administrative post, the 'minister of peace and war', was introduced during the Gupta period, and who was the mantri under Kautilya's system?",
        "gold_chunk_ids": ["87842336-5256-50fe-8846-936412051561"],
    },
    {
        "id": "statesociety_15",
        "chapter": "State and Society up to 1000 CE",
        "question": "What was unique about the Junagadh Rock Inscription near Girnar, Gujarat, and which three rulers' inscriptions does it bear?",
        "gold_chunk_ids": ["12c91327-c4a4-5be0-a95a-955affc739b3"],
    },
    {
        "id": "statesociety_17",
        "chapter": "State and Society up to 1000 CE",
        "question": "What were Brahmadeya villages, and which dynasty was known for granting them as tax-free land grants?",
        "gold_chunk_ids": ["58e4ff61-311b-5547-802a-f07567af9094", "e4482a94-3263-5ea4-8b2e-d866f0e0a69e"],
    },
    {
        "id": "statesociety_18",
        "chapter": "State and Society up to 1000 CE",
        "question": "What was the 'tri-partite struggle', and which three major powers were involved in it?",
        "gold_chunk_ids": ["81848b62-3412-5df9-8f04-9bdcfad92be0"],
    },
    {
        "id": "statesociety_19",
        "chapter": "State and Society up to 1000 CE",
        "question": "What was the Kudavolai or 'ballot pot' system described in the Uttaramerur inscription of Parantaka I, and how did it work?",
        "gold_chunk_ids": ["4e34a6f9-19d0-51af-8410-0bf061d8f439"],
    },
    {
        "id": "statesociety_21",
        "chapter": "State and Society up to 1000 CE",
        "question": "What were the four varnas of early Indian society, and what roles were the brahmanas, kshatriyas, vaishyas, and shudras expected to perform?",
        "gold_chunk_ids": ["a12ef968-1a78-5593-ac43-4e1fb7c82396"],
    },
    {
        "id": "statesociety_23",
        "chapter": "State and Society up to 1000 CE",
        "question": "How did the social structure of jati emerge, and was the number of jatis fixed like the four varnas?",
        "gold_chunk_ids": ["a12ef968-1a78-5593-ac43-4e1fb7c82396", "fbe68ff6-0e7a-5e6d-a0f9-c49d729a256e"],
    },
    {
        "id": "statesociety_25",
        "chapter": "State and Society up to 1000 CE",
        "question": "What are the four ashramas (stages of life) described in the chapter?",
        "gold_chunk_ids": ["62d078c3-13ba-520e-b869-92ef7b56cacc"],
    },
    {
        "id": "statesociety_26",
        "chapter": "State and Society up to 1000 CE",
        "question": "What are the shodasha samskaras, or 'sixteen rites of passage', and what kinds of life events did they mark?",
        "gold_chunk_ids": ["62d078c3-13ba-520e-b869-92ef7b56cacc"],
    },
    {
        "id": "statesociety_27",
        "chapter": "State and Society up to 1000 CE",
        "question": "What are the four goals of life (purusharthas) described in the chapter?",
        "gold_chunk_ids": ["e31a660e-e5cd-5f49-9832-154097b56e5b"],
    },
    {
        "id": "statesociety_28",
        "chapter": "State and Society up to 1000 CE",
        "question": "What evidence does the chapter give for women's active engagement in intellectual and religious life during the Vedic period?",
        "gold_chunk_ids": ["6a30306c-682a-5fd2-8af5-5b52ef45e583", "e31a660e-e5cd-5f49-9832-154097b56e5b"],
    },
    {
        "id": "statesociety_29",
        "chapter": "State and Society up to 1000 CE",
        "question": "What roles did women play in Sangam-era southern Indian society and economy, according to the chapter?",
        "gold_chunk_ids": ["768c1a90-2fb7-5611-aa8a-e82007ce2061"],
    },
    {
        "id": "statesociety_30",
        "chapter": "State and Society up to 1000 CE",
        "question": "What is Bhakti, and in which region and century did the organised Bhakti tradition gain prominence through the Alvars and Nayanmars?",
        "gold_chunk_ids": ["a8bcebc9-2c93-5620-8a3b-b7382bb84137"],
    },
    {
        "id": "statesociety_31",
        "chapter": "State and Society up to 1000 CE",
        "question": "What is the teacher-student relationship called in early Indian education, and how was the teacher regarded?",
        "gold_chunk_ids": ["740fae21-4ad8-546f-afe7-28b3d08f672e"],
    },
    {
        "id": "statesociety_34",
        "chapter": "State and Society up to 1000 CE",
        "question": "What was the basic tax rate on agricultural land during the Mauryan period, and how was land classified for revenue assessment?",
        "gold_chunk_ids": ["446d56f2-7ce2-5ceb-8ed7-3bafa989bfa3"],
    },
    {
        "id": "statesociety_36",
        "chapter": "State and Society up to 1000 CE",
        "question": "Who built the Grand Anicut (Kallanai), and why is it remarkable according to the chapter?",
        "gold_chunk_ids": ["fa625309-95bc-5bc7-8fd0-4316e705a281"],
    },
    {
        "id": "statesociety_37",
        "chapter": "State and Society up to 1000 CE",
        "question": "What were guilds (shrenis) in early India, and what role did the Nashik cave inscription reveal about their function as financial institutions?",
        "gold_chunk_ids": ["693ece31-5bc0-5a5f-a000-47b1bff594c7"],
    },
    {
        "id": "statesociety_39",
        "chapter": "State and Society up to 1000 CE",
        "question": "What two major land trade routes had emerged by around the 6th century BCE, connecting different parts of the Indian subcontinent?",
        "gold_chunk_ids": ["756a8ccc-b58f-5bba-84eb-5508a9638458", "ff1965c6-ae44-5299-9bbf-4a85c1487236"],
    },
    {
        "id": "statesociety_40",
        "chapter": "State and Society up to 1000 CE",
        "question": "What is the concept of 'samatva' or the principle of sameness, as described in the chapter's discussion of ethics?",
        "gold_chunk_ids": ["22e11009-863e-59ca-9f75-667e656d9f18", "9dfd4ad1-b9dc-592d-a54f-8d6906fd07bd"],
    },
    {
        "id": "statesociety_42",
        "chapter": "State and Society up to 1000 CE",
        "question": "What did Ashoka's edicts promote through the philosophy of dhamma, and what qualities did the 10th century Uttaramerur inscription require of candidates for village assembly elections?",
        "gold_chunk_ids": ["bee53a41-ec00-5bfa-8a2b-6ce991ea81dc"],
    },
]

# Chapter: "Democracy"

GOLD_QUESTIONS += [
    {
        "id": "democracy_01",
        "chapter": "Democracy",
        "question": "According to 2024 figures cited in the chapter, what was India's population and registered voter base, making it the world's largest democracy?",
        "gold_chunk_ids": ["0d07390f-8103-5290-9fb5-30b60f2d93fb"],
    },
    {
        "id": "democracy_02",
        "chapter": "Democracy",
        "question": "On what dates was the Constitution of India adopted and when did it come into force?",
        "gold_chunk_ids": ["0d07390f-8103-5290-9fb5-30b60f2d93fb"],
    },
    {
        "id": "democracy_03",
        "chapter": "Democracy",
        "question": "What democratic principles from the Vedic period does the verse from the Aikyamatya Suktam of the Rig Veda emphasise?",
        "gold_chunk_ids": ["a9db2e35-3dbf-5d3b-9c3d-1aec24747454", "34e268cb-5b9d-50e9-a06f-87bcca5cf49a"],
    },
    {
        "id": "democracy_05",
        "chapter": "Democracy",
        "question": "How long did it take the Constituent Assembly to draft the Constitution of India?",
        "gold_chunk_ids": ["34e268cb-5b9d-50e9-a06f-87bcca5cf49a", "e543d95e-d293-5dac-965d-d535e56ffc62"],
    },
    {
        "id": "democracy_06",
        "chapter": "Democracy",
        "question": "What is popular sovereignty, and what is the Universal Adult Franchise?",
        "gold_chunk_ids": ["e543d95e-d293-5dac-965d-d535e56ffc62"],
    },
    {
        "id": "democracy_07",
        "chapter": "Democracy",
        "question": "What does the Rule of Law ensure, according to the chapter?",
        "gold_chunk_ids": ["57a66308-9722-5a53-85a9-aaf077ba30ff"],
    },
    {
        "id": "democracy_08",
        "chapter": "Democracy",
        "question": "What are the six Fundamental Rights enshrined in the Indian Constitution, along with their article ranges?",
        "gold_chunk_ids": ["57a66308-9722-5a53-85a9-aaf077ba30ff"],
    },
    {
        "id": "democracy_09",
        "chapter": "Democracy",
        "question": "What is the separation of powers, and how do the legislature, executive, and judiciary check each other according to the chapter?",
        "gold_chunk_ids": ["a49df9c2-8eb1-5d05-8b68-de2af743e176"],
    },
    {
        "id": "democracy_10",
        "chapter": "Democracy",
        "question": "What are the four types of democracy described in Fig. 6.4, and give an example country for each?",
        "gold_chunk_ids": ["6605dd89-b376-52cb-916e-0890c1043027"],
    },
    {
        "id": "democracy_11",
        "chapter": "Democracy",
        "question": "Why is the media often referred to as the 'fourth pillar of democracy'?",
        "gold_chunk_ids": ["6605dd89-b376-52cb-916e-0890c1043027"],
    },
    {
        "id": "democracy_12",
        "chapter": "Democracy",
        "question": "In a multi-party system, what percentage of seats must a party or coalition secure to form the government, according to the chapter?",
        "gold_chunk_ids": ["abf77d1c-85d2-5bbb-8298-e86a285ae180"],
    },
    {
        "id": "democracy_13",
        "chapter": "Democracy",
        "question": "According to the 'Don't Miss Out' facts, on average how many people does a single Member of Parliament represent in India, and in how many scheduled languages are Indian elections conducted?",
        "gold_chunk_ids": ["da1316b5-1775-58d3-8d9c-df6d5ef8b029"],
    },
    {
        "id": "democracy_15",
        "chapter": "Democracy",
        "question": "What reservation for women does Article 243(d) of the Constitution provide in Panchayats, and how many states and Union Territories have gone further with 50% reservation?",
        "gold_chunk_ids": ["78f0ccfb-bf12-50fb-a75b-9b28a8b89088"],
    },
    {
        "id": "democracy_16",
        "chapter": "Democracy",
        "question": "In what years did women gain full voting rights in Britain and the United States, and how did this compare to India's experience?",
        "gold_chunk_ids": ["78f0ccfb-bf12-50fb-a75b-9b28a8b89088"],
    },
    {
        "id": "democracy_17",
        "chapter": "Democracy",
        "question": "What was the Emergency of 1975-77 in India, and what circumstances led to it being imposed?",
        "gold_chunk_ids": ["777dac5a-fb4b-5fcb-a259-c301a6ab22d3", "bc55bde7-884d-5332-b6e1-87d4adc3dc5e"],
    },
    {
        "id": "democracy_19",
        "chapter": "Democracy",
        "question": "What is the Right to Information (RTI) Act, 2005, and what does it empower citizens to do?",
        "gold_chunk_ids": ["48301903-2b64-5b64-8972-4342ff0fa658"],
    },
]

# Chapter: "Elections"

GOLD_QUESTIONS += [
    {
        "id": "elections_01",
        "chapter": "Elections",
        "question": "On what date was the Election Commission of India (ECI) established, and which articles of the Constitution provide for it?",
        "gold_chunk_ids": ["7192c22c-15ad-5a61-9e04-4c96375ccc85"],
    },
    {
        "id": "elections_02",
        "chapter": "Elections",
        "question": "What is psephology, and from which Greek words is the term derived?",
        "gold_chunk_ids": ["173aed63-ff78-530a-a679-14ec09b2d8fe"],
    },
    {
        "id": "elections_03",
        "chapter": "Elections",
        "question": "What is the difference between direct elections and indirect elections, and which Indian offices are filled through each?",
        "gold_chunk_ids": ["9a2e496e-115b-53ce-af1d-98447d788aa0"],
    },
    {
        "id": "elections_04",
        "chapter": "Elections",
        "question": "What electoral system, also known as the 'First-Past-The-Post' (FPTP) system, did the framers of the Constitution choose for elections to the Lok Sabha and Vidhan Sabha?",
        "gold_chunk_ids": ["3d9e57c1-c6d0-500b-81f9-f2a41b617219"],
    },
    {
        "id": "elections_06",
        "chapter": "Elections",
        "question": "How does the Proportional Representation (PR) electoral system differ from the First-Past-The-Post (FPTP) system, according to the chapter's comparison table?",
        "gold_chunk_ids": ["aab80954-1a2a-5497-87cc-4e077b0fbb73"],
    },
    {
        "id": "elections_08",
        "chapter": "Elections",
        "question": "What do the Representation of the People Act, 1950, and the Representation of the People Act, 1951, each deal with?",
        "gold_chunk_ids": ["d65f5300-0b36-55c7-9e78-0fb21ea30d58"],
    },
    {
        "id": "elections_09",
        "chapter": "Elections",
        "question": "What is the Special Intensive Revision (SIR) conducted by the ECI, and what does it aim to ensure?",
        "gold_chunk_ids": ["7d7c9a88-28c7-55c4-8e6d-f9851927e227", "51fa02a9-15d6-51f2-a1aa-bcb1ddb8bc8a"],
    },
    {
        "id": "elections_10",
        "chapter": "Elections",
        "question": "What is the Delimitation Commission, and how many Delimitation Commissions has India had, according to the chapter?",
        "gold_chunk_ids": ["7d7c9a88-28c7-55c4-8e6d-f9851927e227"],
    },
    {
        "id": "elections_11",
        "chapter": "Elections",
        "question": "What criteria must a political party meet to be recognised as a National Party, according to Fig. 7.12?",
        "gold_chunk_ids": ["0651eef8-717d-5bbd-9bf3-3d37060bb17b", "187302a8-2299-5dc1-8071-ab68bb1de0e0"],
    },
    {
        "id": "elections_13",
        "chapter": "Elections",
        "question": "What is defection, and what does the Anti-Defection Law of 1985 (52nd Constitutional Amendment Act) provide for?",
        "gold_chunk_ids": ["3fda67b6-b145-58c8-bdd2-549bd682e587"],
    },
    {
        "id": "elections_14",
        "chapter": "Elections",
        "question": "What year marked the end of single-party dominated elections in India and the beginning of the era of alliances, and which alliance formed the first coalition government at the national level in 1977?",
        "gold_chunk_ids": ["3cfbe8cc-0b26-5fca-8b8d-34cf573a3574"],
    },
    {
        "id": "elections_15",
        "chapter": "Elections",
        "question": "What was extended across India for the first time during the 2024 General Elections for senior citizens above 85 years of age and persons with disabilities?",
        "gold_chunk_ids": ["2414edd9-3568-5fc4-9dbf-059ea1c34434", "eefc6246-6648-501c-a635-065e7d66eab9"],
    },
    {
        "id": "elections_16",
        "chapter": "Elections",
        "question": "What is ETPBS, and who is it designed for?",
        "gold_chunk_ids": ["6214723c-afc7-56ac-9af5-43b1aefec895", "eef3b140-3633-54d0-9184-857e4398d980"],
    },
    {
        "id": "elections_19",
        "chapter": "Elections",
        "question": "What day is celebrated as National Voters' Day in India, according to the chapter?",
        "gold_chunk_ids": ["8344b7b9-35a6-5c21-a02f-a4e45febd1fd"],
    },
    {
        "id": "elections_20",
        "chapter": "Elections",
        "question": "What role do political parties play in a democracy, according to Fig. 7.9?",
        "gold_chunk_ids": ["eefc6246-6648-501c-a635-065e7d66eab9"],
    },
    {
        "id": "elections_22",
        "chapter": "Elections",
        "question": "What electoral offences and corrupt practices are listed under the Representation of the People Act, 1951?",
        "gold_chunk_ids": ["7d7c9a88-28c7-55c4-8e6d-f9851927e227"],
    },
]

# Chapter: "Building Blocks in Economics - The Problem of Choice"

GOLD_QUESTIONS += [
    {
        "id": "econchoice_01",
        "chapter": "Building Blocks in Economics - The Problem of Choice",
        "question": "From which Greek words is the term 'Economics' derived, and what do they mean?",
        "gold_chunk_ids": ["d47198d0-d2ba-5696-bd4e-0e5f0b67a826"],
    },
    {
        "id": "econchoice_02",
        "chapter": "Building Blocks in Economics - The Problem of Choice",
        "question": "What is the difference between 'needs' and 'wants', according to the chapter?",
        "gold_chunk_ids": ["c7fecef1-79e1-54d4-9c30-25cac2526c71"],
    },
    {
        "id": "econchoice_03",
        "chapter": "Building Blocks in Economics - The Problem of Choice",
        "question": "What is opportunity cost, and how is it illustrated through the farmer's choice between growing barley and wheat?",
        "gold_chunk_ids": ["a3bd20a7-4bac-53b0-9e8a-67fe6f62d9e4"],
    },
    {
        "id": "econchoice_04",
        "chapter": "Building Blocks in Economics - The Problem of Choice",
        "question": "What is the Production Possibility Curve (PPC), and what does it show?",
        "gold_chunk_ids": ["f7bb4bd4-5973-5047-b029-40105bec86f6"],
    },
    {
        "id": "econchoice_06",
        "chapter": "Building Blocks in Economics - The Problem of Choice",
        "question": "What are the three key questions that the discipline of economics seeks to address, given the mismatch between unlimited wants and limited resources?",
        "gold_chunk_ids": ["711653e5-1988-5523-9e3a-a3d0b38d121d"],
    },
    {
        "id": "econchoice_07",
        "chapter": "Building Blocks in Economics - The Problem of Choice",
        "question": "What factors determine whether producers use labour-intensive or capital-intensive methods of production when deciding 'how to produce'?",
        "gold_chunk_ids": ["c0f2daeb-d59e-5f54-aac1-d9bb7788e050"],
    },
    {
        "id": "econchoice_09",
        "chapter": "Building Blocks in Economics - The Problem of Choice",
        "question": "What is a market economy, and which countries are given as prominent examples?",
        "gold_chunk_ids": ["ad24f4ea-fd32-549b-bb1a-45a730a193dd", "d3320d54-0dab-5514-bb56-ac30cbee5af2"],
    },
    {
        "id": "econchoice_10",
        "chapter": "Building Blocks in Economics - The Problem of Choice",
        "question": "What is a planned economy, and which countries are given as examples?",
        "gold_chunk_ids": ["d3320d54-0dab-5514-bb56-ac30cbee5af2"],
    },
    {
        "id": "econchoice_11",
        "chapter": "Building Blocks in Economics - The Problem of Choice",
        "question": "What is a mixed economy, and which countries are given as examples?",
        "gold_chunk_ids": ["3bd81790-808f-5eb2-902d-baf1fe63dd96", "5dbf6940-7d8a-5d95-b487-9c731081636c"],
    },
    {
        "id": "econchoice_12",
        "chapter": "Building Blocks in Economics - The Problem of Choice",
        "question": "By what year did India face serious economic difficulties leading to major economic reforms, according to the chapter's 'Don't Miss Out' note?",
        "gold_chunk_ids": ["3bd81790-808f-5eb2-902d-baf1fe63dd96", "591a8dcc-aea4-51c8-a27e-faaafed61769"],
    },
    {
        "id": "econchoice_13",
        "chapter": "Building Blocks in Economics - The Problem of Choice",
        "question": "What is the Economic Survey of India, and which ministry prepares it before the Union Budget?",
        "gold_chunk_ids": ["67ea5027-12d4-52f8-afa5-a0f0b86e8af2"],
    },
    {
        "id": "econchoice_14",
        "chapter": "Building Blocks in Economics - The Problem of Choice",
        "question": "What is a public good, and what examples of public goods does the chapter give?",
        "gold_chunk_ids": ["3bd81790-808f-5eb2-902d-baf1fe63dd96"],
    },
]

# Chapter: "The Prize Puzzle - What Drives the Market"

GOLD_QUESTIONS += [
    {
        "id": "market_01",
        "chapter": "The Prize Puzzle - What Drives the Market",
        "question": "What is the Law of Demand, and what inverse relationship does it describe?",
        "gold_chunk_ids": ["bd861264-74c8-5cfb-98eb-aa50b89fc544"],
    },
    {
        "id": "market_02",
        "chapter": "The Prize Puzzle - What Drives the Market",
        "question": "What is individual demand, and how is Srivalli's demand schedule for mangoes illustrated at prices of ₹150, ₹100, and ₹50 per kg?",
        "gold_chunk_ids": ["bd861264-74c8-5cfb-98eb-aa50b89fc544", "b493822c-fc37-5461-b52e-1570a7023bc4"],
    },
    {
        "id": "market_03",
        "chapter": "The Prize Puzzle - What Drives the Market",
        "question": "What is market demand, and according to Table 9.1, what is the total market demand for mangoes when the price is ₹100?",
        "gold_chunk_ids": ["bc7d55ac-b4ba-5eb6-a3a7-b1ba987d87b9", "a802af46-e344-51b2-9dfe-fb38f1482e80"],
    },
    {
        "id": "market_04",
        "chapter": "The Prize Puzzle - What Drives the Market",
        "question": "What is the difference between substitute goods and complementary goods, with examples from the chapter?",
        "gold_chunk_ids": ["10a9da7a-6013-5a95-bce3-855a1ef193b2", "ea16a5a1-bdfd-5e19-b0ec-260d4325dca0"],
    },
    {
        "id": "market_05",
        "chapter": "The Prize Puzzle - What Drives the Market",
        "question": "What is the diminishing marginal utility principle, and how does the chapter illustrate it using the example of eating mangoes?",
        "gold_chunk_ids": ["cb31c67f-d9fc-53f4-a527-7ea8b7c91c6b"],
    },
    {
        "id": "market_07",
        "chapter": "The Prize Puzzle - What Drives the Market",
        "question": "What is the Law of Supply, and what direct relationship does it describe?",
        "gold_chunk_ids": ["a97aac7b-9cc0-5aa1-82d9-115abd32cf18"],
    },
    {
        "id": "market_08",
        "chapter": "The Prize Puzzle - What Drives the Market",
        "question": "According to Table 9.2, what is the total market supply of mangoes from sellers A, B, and C when the price is ₹150?",
        "gold_chunk_ids": ["ae74d5cf-53fd-5483-bea2-44496fc81c82"],
    },
    {
        "id": "market_09",
        "chapter": "The Prize Puzzle - What Drives the Market",
        "question": "What other determinants of supply, besides price, does the chapter describe?",
        "gold_chunk_ids": ["7bf567b7-f2c8-51a7-ab5b-ca5e95433d80"],
    },
    {
        "id": "market_10",
        "chapter": "The Prize Puzzle - What Drives the Market",
        "question": "According to Table 9.3, at what price and quantity does market equilibrium occur for mangoes, and what happens at a price of ₹150?",
        "gold_chunk_ids": ["2d20fdc4-a8f5-5e6b-b4d4-cbce6b7f1e6d", "831b8e1a-7d1b-5f9a-beeb-6dd052aad720"],
    },
    {
        "id": "market_11",
        "chapter": "The Prize Puzzle - What Drives the Market",
        "question": "Does market equilibrium remain stable in the real world, according to the chapter, and what example involving face masks during COVID-19 illustrates this?",
        "gold_chunk_ids": ["55104033-759e-53ad-81f3-37301125bf48"],
    },
    {
        "id": "market_12",
        "chapter": "The Prize Puzzle - What Drives the Market",
        "question": "How did hotel room tariffs in Goa vary between an off-season weekday, a weekend during tourist season, and New Year's Eve, according to the chapter's example of dynamic markets?",
        "gold_chunk_ids": ["2fdca506-d814-5bf1-95f7-fd8a6e2f68e5"],
    },
    {
        "id": "market_13",
        "chapter": "The Prize Puzzle - What Drives the Market",
        "question": "What is a price ceiling, and how did the government use it during COVID-19 to cap the price of sanitisers?",
        "gold_chunk_ids": ["3428dcfa-de7a-5b47-9a5c-1790d86dd8d6", "0ac76722-1d00-5727-9ff5-ccf7f73d8d16"],
    },
    {
        "id": "market_14",
        "chapter": "The Prize Puzzle - What Drives the Market",
        "question": "What is a price floor, and how is it used to ensure workers earn a minimum wage?",
        "gold_chunk_ids": ["0ac76722-1d00-5727-9ff5-ccf7f73d8d16", "f0aef38f-bc2b-584b-adbd-95c53b23c3ec"],
    },
    {
        "id": "market_15",
        "chapter": "The Prize Puzzle - What Drives the Market",
        "question": "What is a monopoly, and why can it be detrimental to consumer welfare?",
        "gold_chunk_ids": ["0ac76722-1d00-5727-9ff5-ccf7f73d8d16"],
    },
    {
        "id": "market_17",
        "chapter": "The Prize Puzzle - What Drives the Market",
        "question": "Why are public goods usually not provided by private companies, and what 'free rider' problem does the neighbourhood park example illustrate?",
        "gold_chunk_ids": ["3428dcfa-de7a-5b47-9a5c-1790d86dd8d6", "89c6ea4a-d881-5d42-b033-d6487d82ab35"],
    },
    {
        "id": "market_18",
        "chapter": "The Prize Puzzle - What Drives the Market",
        "question": "What are the three limitations of excessive government intervention in markets described in the chapter?",
        "gold_chunk_ids": ["2fddf96b-2711-54a8-9288-0e3502d73d2e"],
    },
]
