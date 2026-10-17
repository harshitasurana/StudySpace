# -*- coding: utf-8 -*-
# Gold question set for the NCERT-RAG-Eval-style benchmark, built against
# the REAL local RAGProductionApp corpus (Qdrant "docs" collection /
# rag_benchmark/corpus_cache/all_chunks.jsonl), subject "English", 382
# chunks across 16 chapters. Each question is hand-written from actually
# reading the source chunk text (not synthetic/templated), with gold
# chunk id(s) recorded exactly as they exist in the corpus today.
#
# IMPORTANT NOTE ON THE SOURCE DATA: this corpus mixes two parallel
# Class 9 English textbooks (a prose/poetry "reader" and a supplementary
# book), and chapter_number collides across them, so chunks were grouped
# strictly by the exact `chapter` string. During review it was also
# discovered that a number of chunks near chapter boundaries carry the
# chapter tag of a NEIGHBOURING chapter (e.g. some chunks whose actual
# text belongs to "Bharat Our Land" are tagged chapter="How I Taught My
# Grandmother to Read", since that poem immediately follows the story in
# the printed book). Every question below was written only from chunks
# whose tagged `chapter` field matches the chapter the question is filed
# under, and whose text is genuinely about that chapter's content, so no
# question relies on a mistagged/boundary-bleed chunk.

GOLD_QUESTIONS = []

# Chapter: "Bharat Our Land" (English, Class 9) - poem by Subramania Bharati

GOLD_QUESTIONS += [
    {
        "id": "bharat_01",
        "chapter": "Bharat Our Land",
        "question": "Who is the poet of the poem 'Bharat Our Land'?",
        "gold_chunk_ids": ["09dee819-f05d-5dd7-baa6-2ae0e8e48dfa"],
    },
    {
        "id": "bharat_02",
        "chapter": "Bharat Our Land",
        "question": "According to the final stanza of the poem, where has Brahma-knowledge taken root and who preached his dhamma there?",
        "gold_chunk_ids": ["09dee819-f05d-5dd7-baa6-2ae0e8e48dfa"],
    },
    {
        "id": "bharat_03",
        "chapter": "Bharat Our Land",
        "question": "According to the poem, what does the poet say about the Himavant (the Himalayas)?",
        "gold_chunk_ids": ["29a86b01-af98-5204-a6a9-7cfb673d1a61"],
    },
    {
        "id": "bharat_04",
        "chapter": "Bharat Our Land",
        "question": "According to the poem, how is the Ganga river described?",
        "gold_chunk_ids": ["29a86b01-af98-5204-a6a9-7cfb673d1a61", "614c4407-2bb7-5425-8789-980cfb6b3caf"],
    },
    {
        "id": "bharat_05",
        "chapter": "Bharat Our Land",
        "question": "According to the poem, what does the poet say about the Upanishads?",
        "gold_chunk_ids": ["29a86b01-af98-5204-a6a9-7cfb673d1a61", "614c4407-2bb7-5425-8789-980cfb6b3caf"],
    },
    {
        "id": "bharat_06",
        "chapter": "Bharat Our Land",
        "question": "According to the closing lines of the poem, what has been heard in this land, and what is found here?",
        "gold_chunk_ids": ["29a86b01-af98-5204-a6a9-7cfb673d1a61"],
    },
    {
        "id": "bharat_07",
        "chapter": "Bharat Our Land",
        "question": "What example does the chapter give to illustrate allusion, and what literary device does it define it as?",
        "gold_chunk_ids": ["614c4407-2bb7-5425-8789-980cfb6b3caf"],
    },
    {
        "id": "bharat_08",
        "chapter": "Bharat Our Land",
        "question": "How does the chapter define an 'ode', and why is 'Bharat Our Land' considered an example of one?",
        "gold_chunk_ids": ["7f39ad2e-503a-5692-b7f9-8b61526010bb"],
    },
    {
        "id": "bharat_09",
        "chapter": "Bharat Our Land",
        "question": "According to the symbolism matching exercise, what does the Ganga symbolise in the poem?",
        "gold_chunk_ids": ["8893ef01-01c0-5275-b20f-862ab65ce3c1"],
    },
    {
        "id": "bharat_10",
        "chapter": "Bharat Our Land",
        "question": "According to the symbolism matching exercise, what does the Himavant symbolise in the poem?",
        "gold_chunk_ids": ["8893ef01-01c0-5275-b20f-862ab65ce3c1"],
    },
    {
        "id": "bharat_11",
        "chapter": "Bharat Our Land",
        "question": "What geographical features and Indian examples are listed for the interdisciplinary project on India's major geographical features (mountains, rivers, deserts, valleys, islands, plateaus)?",
        "gold_chunk_ids": ["2215ed33-fbe4-588b-98d5-7807cd9c7ad8"],
    },
    {
        "id": "bharat_12",
        "chapter": "Bharat Our Land",
        "question": "According to the poem, what does the poet say about the warriors and sages who have lived on this land?",
        "gold_chunk_ids": ["29a86b01-af98-5204-a6a9-7cfb673d1a61"],
    },
    {
        "id": "bharat_13",
        "chapter": "Bharat Our Land",
        "question": "In the vocabulary exercise on the phrase 'of hoary antiquity', which of the given options (ancient times, recent past, time immemorial) is the odd one out that does not match the underlined word's meaning?",
        "gold_chunk_ids": ["48e07510-5dbc-5256-bc8d-0fd609b94141"],
    },
    {
        "id": "bharat_14",
        "chapter": "Bharat Our Land",
        "question": "According to the poem, how is the land described using the metaphor 'sunny golden land'?",
        "gold_chunk_ids": ["29a86b01-af98-5204-a6a9-7cfb673d1a61", "8893ef01-01c0-5275-b20f-862ab65ce3c1"],
    },
]

# Chapter: "How I Taught My Grandmother to Read" (English, Class 9) - story by Sudha Murty

GOLD_QUESTIONS += [
    {
        "id": "grandmother_01",
        "chapter": "How I Taught My Grandmother to Read",
        "question": "Where did the narrator stay with her grandparents when she was about twelve years old?",
        "gold_chunk_ids": ["a3931815-7531-5edc-9cc0-e738ae6afb43"],
    },
    {
        "id": "grandmother_02",
        "chapter": "How I Taught My Grandmother to Read",
        "question": "Who was Triveni, and what were her stories usually about?",
        "gold_chunk_ids": ["a3931815-7531-5edc-9cc0-e738ae6afb43", "3e3e26a5-f04e-5a17-bdb2-0ab6882d0edf"],
    },
    {
        "id": "grandmother_03",
        "chapter": "How I Taught My Grandmother to Read",
        "question": "What is Triveni's novel 'Kashi Yatre' about?",
        "gold_chunk_ids": ["3e3e26a5-f04e-5a17-bdb2-0ab6882d0edf"],
    },
    {
        "id": "grandmother_04",
        "chapter": "How I Taught My Grandmother to Read",
        "question": "What did the narrator call her grandmother, and what does that word mean?",
        "gold_chunk_ids": ["dc0056bb-af7e-5afa-a7c1-a49a5391b8cf"],
    },
    {
        "id": "grandmother_05",
        "chapter": "How I Taught My Grandmother to Read",
        "question": "Why did the narrator find her grandmother in tears when she returned from a week-long wedding trip?",
        "gold_chunk_ids": ["0fed49b0-6567-52c2-9bc3-29954c1bf47d"],
    },
    {
        "id": "grandmother_06",
        "chapter": "How I Taught My Grandmother to Read",
        "question": "According to the grandmother's account of her early life, why did she never go to school?",
        "gold_chunk_ids": ["5b1d6c0b-e662-5c7b-a6e2-9537cfe70fae"],
    },
    {
        "id": "grandmother_07",
        "chapter": "How I Taught My Grandmother to Read",
        "question": "What deadline did the grandmother set for herself to learn to read, and what did she want to be able to do by then?",
        "gold_chunk_ids": ["0fed49b0-6567-52c2-9bc3-29954c1bf47d"],
    },
    {
        "id": "grandmother_08",
        "chapter": "How I Taught My Grandmother to Read",
        "question": "How did the narrator initially react to her grandmother's decision to learn the alphabet at age sixty-two?",
        "gold_chunk_ids": ["0fed49b0-6567-52c2-9bc3-29954c1bf47d"],
    },
    {
        "id": "grandmother_09",
        "chapter": "How I Taught My Grandmother to Read",
        "question": "What did the grandmother say about learning and age, in response to the narrator's teasing?",
        "gold_chunk_ids": ["0fed49b0-6567-52c2-9bc3-29954c1bf47d"],
    },
    {
        "id": "grandmother_10",
        "chapter": "How I Taught My Grandmother to Read",
        "question": "What unusual gesture did the grandmother make on Dassara day, and what reason did she give for it?",
        "gold_chunk_ids": ["2dfef8c7-25f6-5440-9691-4cf71e669b30"],
    },
    {
        "id": "grandmother_11",
        "chapter": "How I Taught My Grandmother to Read",
        "question": "What gift did the grandmother give the narrator on Dassara, and how did the narrator know her grandmother had learned to read?",
        "gold_chunk_ids": ["2dfef8c7-25f6-5440-9691-4cf71e669b30"],
    },
    {
        "id": "grandmother_12",
        "chapter": "How I Taught My Grandmother to Read",
        "question": "Who is the author credited for the story 'How I Taught My Grandmother to Read'?",
        "gold_chunk_ids": ["2dfef8c7-25f6-5440-9691-4cf71e669b30"],
    },
    {
        "id": "grandmother_13",
        "chapter": "How I Taught My Grandmother to Read",
        "question": "What idiom is explained in the chapter using the sentence 'I knew, then, that my student had passed with flying colours', and what does it mean?",
        "gold_chunk_ids": ["fc1bf551-deb4-542f-b6c8-d1338d95e223"],
    },
    {
        "id": "grandmother_14",
        "chapter": "How I Taught My Grandmother to Read",
        "question": "What career did the narrator go on to have, despite being her grandmother's first and only student?",
        "gold_chunk_ids": ["0fed49b0-6567-52c2-9bc3-29954c1bf47d"],
    },
    {
        "id": "grandmother_15",
        "chapter": "How I Taught My Grandmother to Read",
        "question": "What did the grandmother do every day while learning that showed she was a 'wonderful student'?",
        "gold_chunk_ids": ["0fed49b0-6567-52c2-9bc3-29954c1bf47d"],
    },
    {
        "id": "grandmother_16",
        "chapter": "How I Taught My Grandmother to Read",
        "question": "What did the grandmother do at the temple courtyard after hearing the next episode of Kashi Yatre, according to the story?",
        "gold_chunk_ids": ["dbc2a07a-09d1-5ae9-acbd-95d02c25e2d5"],
    },
    {
        "id": "grandmother_17",
        "chapter": "How I Taught My Grandmother to Read",
        "question": "How did the grandmother identify with the protagonist of the novel Kashi Yatre, according to the story?",
        "gold_chunk_ids": ["dbc2a07a-09d1-5ae9-acbd-95d02c25e2d5"],
    },
    {
        "id": "grandmother_18",
        "chapter": "How I Taught My Grandmother to Read",
        "question": "What is a binomial, according to the vocabulary section of the chapter, and which binomial expression from the text is used as an example?",
        "gold_chunk_ids": ["eb3fffa0-38d2-5ca5-a96a-512dfb99fcc1"],
    },
    {
        "id": "grandmother_19",
        "chapter": "How I Taught My Grandmother to Read",
        "question": "According to the 'Do you know?' section, what is the role of the National Literacy Mission Authority (NLMA) in India?",
        "gold_chunk_ids": ["f88af0f0-f5cb-5aee-a59e-afd4363ed1cf"],
    },
]

# Chapter: "The Pot Maker" (English, Class 9) - story by Temsula Ao, plus "Quality" by John Galsworthy

GOLD_QUESTIONS += [
    {
        "id": "potmaker_01",
        "chapter": "The Pot Maker",
        "question": "Who is Sentila, and what does she dream of becoming, contrary to her mother's wishes?",
        "gold_chunk_ids": ["3a9009af-f5d3-54b0-8be9-0c1e289ca6bd"],
    },
    {
        "id": "potmaker_02",
        "chapter": "The Pot Maker",
        "question": "According to Arenla's complaint overheard by Sentila, why did she not want to teach her daughter pot making?",
        "gold_chunk_ids": ["3a9009af-f5d3-54b0-8be9-0c1e289ca6bd", "06ae9e18-1263-5a76-9dbf-ed10d5f7dbf8"],
    },
    {
        "id": "potmaker_03",
        "chapter": "The Pot Maker",
        "question": "How far is the riverbank where the clay for pot making is found, according to Arenla?",
        "gold_chunk_ids": ["3a9009af-f5d3-54b0-8be9-0c1e289ca6bd"],
    },
    {
        "id": "potmaker_04",
        "chapter": "The Pot Maker",
        "question": "What happened when the village council summoned Sentila's father, Mesoba, to explain Arenla's refusal to teach pottery to Sentila?",
        "gold_chunk_ids": ["2662a1b0-8796-5285-87a2-65ddda8c80fc"],
    },
    {
        "id": "potmaker_05",
        "chapter": "The Pot Maker",
        "question": "Who is Onula, and how does she secretly help Sentila in the story?",
        "gold_chunk_ids": ["b99835ce-3dbc-5f59-9d11-5fdc63d09215", "a85c4443-9b99-5e95-aa05-2e7386247d8c"],
    },
    {
        "id": "potmaker_06",
        "chapter": "The Pot Maker",
        "question": "What mistake did Onula point out even after Sentila successfully made a beautiful pot on her own?",
        "gold_chunk_ids": ["b99835ce-3dbc-5f59-9d11-5fdc63d09215"],
    },
    {
        "id": "potmaker_07",
        "chapter": "The Pot Maker",
        "question": "What happened to Arenla on the day Sentila made a full batch of pots nearly matching her mother's tally?",
        "gold_chunk_ids": ["7c6917e7-d1b4-5987-ae67-414f1a11cb70"],
    },
    {
        "id": "potmaker_08",
        "chapter": "The Pot Maker",
        "question": "What did Sentila cry out to her mother's body as it was being carried out of the house?",
        "gold_chunk_ids": ["7c6917e7-d1b4-5987-ae67-414f1a11cb70"],
    },
    {
        "id": "potmaker_09",
        "chapter": "The Pot Maker",
        "question": "What did Onula discover in the work shed after Arenla's death, and what did it lead her to believe?",
        "gold_chunk_ids": ["7c6917e7-d1b4-5987-ae67-414f1a11cb70", "10b23fee-9c80-5154-88a4-bd81c5433f81"],
    },
    {
        "id": "potmaker_10",
        "chapter": "The Pot Maker",
        "question": "Who is the author credited for the story 'The Pot Maker'?",
        "gold_chunk_ids": ["10b23fee-9c80-5154-88a4-bd81c5433f81"],
    },
    {
        "id": "potmaker_11",
        "chapter": "The Pot Maker",
        "question": "According to the chapter, what happens if a kiln is over-fired or under-fired during pot making?",
        "gold_chunk_ids": ["2662a1b0-8796-5285-87a2-65ddda8c80fc"],
    },
    {
        "id": "potmaker_12",
        "chapter": "The Pot Maker",
        "question": "Who is the narrator's shoemaker in the story 'Quality' by John Galsworthy, and where was his shop located?",
        "gold_chunk_ids": ["1b549909-013b-5971-b18a-553efa0ec7f1"],
    },
    {
        "id": "potmaker_13",
        "chapter": "The Pot Maker",
        "question": "According to 'Quality', what did Mr Gessler say when asked if making boots was hard to do?",
        "gold_chunk_ids": ["1b549909-013b-5971-b18a-553efa0ec7f1"],
    },
    {
        "id": "potmaker_14",
        "chapter": "The Pot Maker",
        "question": "In 'Quality', what happened to Mr Gessler's elder brother between the narrator's visits to the shop?",
        "gold_chunk_ids": ["e13bc2bb-27a7-5ae9-8905-5b4320f7e4de"],
    },
    {
        "id": "potmaker_15",
        "chapter": "The Pot Maker",
        "question": "In 'Quality', what reason does the young man in the shop give for Mr Gessler's death when the narrator returns to find the shop taken over?",
        "gold_chunk_ids": ["20596627-872b-5856-8623-4d98df84f608"],
    },
    {
        "id": "potmaker_16",
        "chapter": "The Pot Maker",
        "question": "According to 'Quality', why did the narrator order many pairs of boots from Mr Gessler after hearing him speak bitterly about the conditions and hardships of his trade?",
        "gold_chunk_ids": ["3c87cf99-8cec-5963-9880-081b6ce6c035"],
    },
    {
        "id": "potmaker_17",
        "chapter": "The Pot Maker",
        "question": "According to the Learning Beyond the Text section, what are some notable regional styles of Indian pottery mentioned in the chapter?",
        "gold_chunk_ids": ["858ed23a-2efc-531f-bc83-fce78d142c9a"],
    },
    {
        "id": "potmaker_18",
        "chapter": "The Pot Maker",
        "question": "According to 'Quality', what did the narrator's boots from Mr Gessler have that made it unnecessary to visit him very often?",
        "gold_chunk_ids": ["c0efec7f-a5d9-546a-af11-496aed1e02e1"],
    },
]

# Chapter: "Gifts of Grace - Honouring our Vocations" (English, Class 9) - poem (Anonymous) plus "The Lamplighter" by R.L. Stevenson

GOLD_QUESTIONS += [
    {
        "id": "giftsgrace_01",
        "chapter": "Gifts of Grace - Honouring our Vocations",
        "question": "Who is the poet credited for the poem 'I hear Bharat celebrating...' in 'Gifts of Grace - Honouring our Vocations'?",
        "gold_chunk_ids": ["670cb38e-3b56-5187-8e7e-1e084c926d9d"],
    },
    {
        "id": "giftsgrace_02",
        "chapter": "Gifts of Grace - Honouring our Vocations",
        "question": "According to the poem, how are carpenters described, and what quality is associated with their craft?",
        "gold_chunk_ids": ["10a534c0-d0cd-5d7f-a228-37410ad9aedb"],
    },
    {
        "id": "giftsgrace_03",
        "chapter": "Gifts of Grace - Honouring our Vocations",
        "question": "According to the poem, what do the electricians do, and what is said about the artisans with lutes?",
        "gold_chunk_ids": ["10a534c0-d0cd-5d7f-a228-37410ad9aedb"],
    },
    {
        "id": "giftsgrace_04",
        "chapter": "Gifts of Grace - Honouring our Vocations",
        "question": "According to the poem, what do boatmen do when they return from the sea?",
        "gold_chunk_ids": ["670cb38e-3b56-5187-8e7e-1e084c926d9d"],
    },
    {
        "id": "giftsgrace_05",
        "chapter": "Gifts of Grace - Honouring our Vocations",
        "question": "According to the poem, how does it describe shoemakers and the quality of shoes?",
        "gold_chunk_ids": ["670cb38e-3b56-5187-8e7e-1e084c926d9d"],
    },
    {
        "id": "giftsgrace_06",
        "chapter": "Gifts of Grace - Honouring our Vocations",
        "question": "What is the significance of the line 'The voice of their vocation is the voice of their identity' according to the poem?",
        "gold_chunk_ids": ["670cb38e-3b56-5187-8e7e-1e084c926d9d"],
    },
    {
        "id": "giftsgrace_07",
        "chapter": "Gifts of Grace - Honouring our Vocations",
        "question": "According to the chapter's critical reflection exercise, what does 'affirm' mean in the extract describing shoemakers?",
        "gold_chunk_ids": ["1ce47d26-a74d-5b52-a419-52a64adf265a"],
    },
    {
        "id": "giftsgrace_08",
        "chapter": "Gifts of Grace - Honouring our Vocations",
        "question": "According to the vocabulary matching exercise, what is a sericulturist and what is a horticulturist?",
        "gold_chunk_ids": ["2fa9311a-7b44-5011-b1b5-752747798cca"],
    },
    {
        "id": "giftsgrace_09",
        "chapter": "Gifts of Grace - Honouring our Vocations",
        "question": "What does the chapter explain ASHA (Accredited Social Health Activist) workers to be, and under which government mission do they work?",
        "gold_chunk_ids": ["2fa9311a-7b44-5011-b1b5-752747798cca"],
    },
    {
        "id": "giftsgrace_10",
        "chapter": "Gifts of Grace - Honouring our Vocations",
        "question": "Who wrote the poem 'The Lamplighter', given as additional reading in the chapter?",
        "gold_chunk_ids": ["44998dbf-f725-5458-93de-08e736136170"],
    },
    {
        "id": "giftsgrace_11",
        "chapter": "Gifts of Grace - Honouring our Vocations",
        "question": "According to the poem 'The Lamplighter', what vocation does the child speaker say they will choose when they are older, and why?",
        "gold_chunk_ids": ["6468f0e8-6a57-5489-a5bd-b2855ea79e9b", "44998dbf-f725-5458-93de-08e736136170"],
    },
    {
        "id": "giftsgrace_12",
        "chapter": "Gifts of Grace - Honouring our Vocations",
        "question": "According to the poem 'The Lamplighter', what tools does Leerie carry as he comes up the street every evening?",
        "gold_chunk_ids": ["6468f0e8-6a57-5489-a5bd-b2855ea79e9b"],
    },
    {
        "id": "giftsgrace_13",
        "chapter": "Gifts of Grace - Honouring our Vocations",
        "question": "What is a Haiku, according to the definition given in the chapter?",
        "gold_chunk_ids": ["44998dbf-f725-5458-93de-08e736136170"],
    },
    {
        "id": "giftsgrace_14",
        "chapter": "Gifts of Grace - Honouring our Vocations",
        "question": "According to the riddles in the chapter, which vocation is described by the clue 'From wheel to kiln, my skill is born, step by step, an art takes form'?",
        "gold_chunk_ids": ["4f7a04a8-5626-5782-b348-a810bf8a91ae"],
    },
    {
        "id": "giftsgrace_15",
        "chapter": "Gifts of Grace - Honouring our Vocations",
        "question": "According to the riddles in the chapter, which vocation is described by 'I lay foundations, brick by brick, to build a house, it's me you pick'?",
        "gold_chunk_ids": ["4f7a04a8-5626-5782-b348-a810bf8a91ae"],
    },
    {
        "id": "giftsgrace_16",
        "chapter": "Gifts of Grace - Honouring our Vocations",
        "question": "What event does the Writing Task ask students to create a poster for, and on what date is it to be held?",
        "gold_chunk_ids": ["770939b0-6b54-58f2-b5b5-f28f83016597"],
    },
]

# Chapter: "Winds of Change" (English, Class 9) - essay on pankhas, plus "The Last Leaf" by O. Henry

GOLD_QUESTIONS += [
    {
        "id": "windschange_01",
        "chapter": "Winds of Change",
        "question": "According to the chapter, what does the word 'pankh' mean, and how is it related to the origin of the word 'pankha'?",
        "gold_chunk_ids": ["943cb265-74ec-545e-8a0f-660965629659"],
    },
    {
        "id": "windschange_02",
        "chapter": "Winds of Change",
        "question": "Where can early evidence of the pankhi (a small plumed fan) be found in India, according to the chapter?",
        "gold_chunk_ids": ["943cb265-74ec-545e-8a0f-660965629659"],
    },
    {
        "id": "windschange_03",
        "chapter": "Winds of Change",
        "question": "What is the appliqué hand fan of Rajasthan made of, according to the chapter?",
        "gold_chunk_ids": ["ced5bad6-77df-5af7-9b6c-df96b3eea8a6"],
    },
    {
        "id": "windschange_04",
        "chapter": "Winds of Change",
        "question": "How does the zardozi hand fan of Rajasthan differ from the appliqué hand fan, according to the chapter?",
        "gold_chunk_ids": ["ced5bad6-77df-5af7-9b6c-df96b3eea8a6"],
    },
    {
        "id": "windschange_05",
        "chapter": "Winds of Change",
        "question": "What are Gujarat's beads hand fans covered with, and what is Gujarat recognised as the centre for, according to the chapter?",
        "gold_chunk_ids": ["ced5bad6-77df-5af7-9b6c-df96b3eea8a6"],
    },
    {
        "id": "windschange_06",
        "chapter": "Winds of Change",
        "question": "What are Bengal's palm leaf hand fans locally called, and what material is used to make the delicate pankhas of Bengal?",
        "gold_chunk_ids": ["049da0f3-fece-5f30-86d0-12d244269a97"],
    },
    {
        "id": "windschange_07",
        "chapter": "Winds of Change",
        "question": "What materials are the Phadh hand fans of Uttar Pradesh adorned with, according to the chapter?",
        "gold_chunk_ids": ["049da0f3-fece-5f30-86d0-12d244269a97"],
    },
    {
        "id": "windschange_08",
        "chapter": "Winds of Change",
        "question": "According to the chapter, what has the pankha handicraft transformed into over time, and what does it now provide to India's artisans?",
        "gold_chunk_ids": ["25d2fb5c-66c6-5bc1-944d-069432b7d086"],
    },
    {
        "id": "windschange_09",
        "chapter": "Winds of Change",
        "question": "According to the chapter, what initiatives help spread awareness about pankhas and preserve the craft?",
        "gold_chunk_ids": ["25d2fb5c-66c6-5bc1-944d-069432b7d086"],
    },
    {
        "id": "windschange_10",
        "chapter": "Winds of Change",
        "question": "According to the critical reflection exercise, which factor is identified as having contributed to the commercialisation of pankhas?",
        "gold_chunk_ids": ["c99d07b1-d5c4-5cbc-95a7-17693a1eb9de"],
    },
    {
        "id": "windschange_11",
        "chapter": "Winds of Change",
        "question": "What example does the chapter give to illustrate the rule that in fixed expressions with 'and', the shorter word comes first (as in 'bread and butter')?",
        "gold_chunk_ids": ["838d711a-c166-52e4-83cc-f31de8868a2e"],
    },
    {
        "id": "windschange_12",
        "chapter": "Winds of Change",
        "question": "How does the chapter define the present perfect tense, using verbs from the pankha essay as examples?",
        "gold_chunk_ids": ["6edf38af-ddf8-5831-813d-d739018d5ea1"],
    },
    {
        "id": "windschange_13",
        "chapter": "Winds of Change",
        "question": "In 'The Last Leaf', what illness does Johnsy suffer from, and what does she believe will happen when the last leaf falls from the ivy creeper?",
        "gold_chunk_ids": ["4cfb315d-60fa-5aec-a138-56a037de4872", "4a92236d-639b-52fc-994e-e56592c4f193"],
    },
    {
        "id": "windschange_14",
        "chapter": "Winds of Change",
        "question": "In 'The Last Leaf', who is Behrman, and what was his lifelong dream?",
        "gold_chunk_ids": ["4cfb315d-60fa-5aec-a138-56a037de4872"],
    },
    {
        "id": "windschange_15",
        "chapter": "Winds of Change",
        "question": "In 'The Last Leaf', what does Sue discover about Behrman and the ivy leaf on the final morning of the story?",
        "gold_chunk_ids": ["9990a72f-a39b-5f8c-bb18-c04e3b81710e"],
    },
    {
        "id": "windschange_16",
        "chapter": "Winds of Change",
        "question": "In 'The Last Leaf', how does Johnsy's attitude change after seeing the last leaf survive the storm?",
        "gold_chunk_ids": ["9990a72f-a39b-5f8c-bb18-c04e3b81710e"],
    },
    {
        "id": "windschange_17",
        "chapter": "Winds of Change",
        "question": "Who is the author credited for the story 'The Last Leaf' in the chapter?",
        "gold_chunk_ids": ["9990a72f-a39b-5f8c-bb18-c04e3b81710e"],
    },
    {
        "id": "windschange_18",
        "chapter": "Winds of Change",
        "question": "According to the chapter's vocabulary matching table, what does 'indigenous' mean?",
        "gold_chunk_ids": ["943cb265-74ec-545e-8a0f-660965629659"],
    },
]

# Chapter: "Canvas of Soil" (English, Class 9) - poem by Maya Anthony, plus "A Sea of Foliage Girds Our Garden Round" by Toru Dutt

GOLD_QUESTIONS += [
    {
        "id": "canvassoil_01",
        "chapter": "Canvas of Soil",
        "question": "Who is the poet of 'Canvas of Soil'?",
        "gold_chunk_ids": ["80907bbc-9bbe-5f53-877d-895fe9afa7e6"],
    },
    {
        "id": "canvassoil_02",
        "chapter": "Canvas of Soil",
        "question": "According to the poem, what is the earth compared to, and what do gardeners' dreams do in it?",
        "gold_chunk_ids": ["80907bbc-9bbe-5f53-877d-895fe9afa7e6"],
    },
    {
        "id": "canvassoil_03",
        "chapter": "Canvas of Soil",
        "question": "According to the poem, what awaits the 'brushstrokes of seeds, planted true'?",
        "gold_chunk_ids": ["80907bbc-9bbe-5f53-877d-895fe9afa7e6"],
    },
    {
        "id": "canvassoil_04",
        "chapter": "Canvas of Soil",
        "question": "According to the poem, what happens to gardens 'in the hands of those who till'?",
        "gold_chunk_ids": ["80907bbc-9bbe-5f53-877d-895fe9afa7e6"],
    },
    {
        "id": "canvassoil_05",
        "chapter": "Canvas of Soil",
        "question": "How does the chapter define 'palette' and 'hue'?",
        "gold_chunk_ids": ["80907bbc-9bbe-5f53-877d-895fe9afa7e6"],
    },
    {
        "id": "canvassoil_06",
        "chapter": "Canvas of Soil",
        "question": "How does the chapter define allegory, and what could the garden symbolise when the poem is read as an allegory?",
        "gold_chunk_ids": ["1d01f28f-8b3e-5f18-9a44-9f852d9c2674"],
    },
    {
        "id": "canvassoil_07",
        "chapter": "Canvas of Soil",
        "question": "In the poem's word from the 'Summer: hot :: Spring: ___' analogy exercise, what does the poem say spring's hue is described as?",
        "gold_chunk_ids": ["30289fd9-9f3e-55de-8a93-23b7deff7d17", "80907bbc-9bbe-5f53-877d-895fe9afa7e6"],
    },
    {
        "id": "canvassoil_08",
        "chapter": "Canvas of Soil",
        "question": "According to the vocabulary exercise, what are some named shades of blue given in the chapter?",
        "gold_chunk_ids": ["17f26b72-99a7-5884-97be-f225c54b4d7a"],
    },
    {
        "id": "canvassoil_09",
        "chapter": "Canvas of Soil",
        "question": "What are two examples of famous gardens of India mentioned in the mini-project section of the chapter?",
        "gold_chunk_ids": ["aae66619-1d2a-57ae-a2f4-e1bb6394c48e"],
    },
    {
        "id": "canvassoil_10",
        "chapter": "Canvas of Soil",
        "question": "Who wrote the poem 'A Sea of Foliage Girds Our Garden Round', given as additional reading in the chapter?",
        "gold_chunk_ids": ["61a6eb22-6ed0-5a3f-b213-c720dde68889"],
    },
    {
        "id": "canvassoil_11",
        "chapter": "Canvas of Soil",
        "question": "According to the poem 'A Sea of Foliage Girds Our Garden Round', what colour are the seemul trees, and what are they compared to?",
        "gold_chunk_ids": ["61a6eb22-6ed0-5a3f-b213-c720dde68889"],
    },
    {
        "id": "canvassoil_12",
        "chapter": "Canvas of Soil",
        "question": "According to Toru Dutt's poem, what happens to the white lotus when the moon looks through the gaps in the bamboo?",
        "gold_chunk_ids": ["61a6eb22-6ed0-5a3f-b213-c720dde68889"],
    },
    {
        "id": "canvassoil_13",
        "chapter": "Canvas of Soil",
        "question": "According to the poem 'Canvas of Soil', what colours are mentioned as part of nature's artwork?",
        "gold_chunk_ids": ["80907bbc-9bbe-5f53-877d-895fe9afa7e6"],
    },
    {
        "id": "canvassoil_14",
        "chapter": "Canvas of Soil",
        "question": "According to the chapter's definitions section, what does the word 'canvas' mean in the context of the poem?",
        "gold_chunk_ids": ["80907bbc-9bbe-5f53-877d-895fe9afa7e6"],
    },
]

# Chapter: "Vitamin-M" (English, Class 9) - story by Asha Nehemiah, plus "The Lost Child" by Mulk Raj Anand

GOLD_QUESTIONS += [
    {
        "id": "vitaminm_01",
        "chapter": "Vitamin-M",
        "question": "What does Ravi's mother jokingly wish someone would invent, and what would it be for?",
        "gold_chunk_ids": ["eaa3b68d-6aca-5940-b4a6-c8d3d3dca02d"],
    },
    {
        "id": "vitaminm_02",
        "chapter": "Vitamin-M",
        "question": "Why did Grandpa come to live with Ravi's family, according to the story?",
        "gold_chunk_ids": ["9037f30c-acd3-5136-ae0c-cc3a54962f0a"],
    },
    {
        "id": "vitaminm_03",
        "chapter": "Vitamin-M",
        "question": "What two worrying incidents happened to Grandpa last month, according to the story (involving his medicines and a walk)?",
        "gold_chunk_ids": ["9037f30c-acd3-5136-ae0c-cc3a54962f0a"],
    },
    {
        "id": "vitaminm_04",
        "chapter": "Vitamin-M",
        "question": "According to Grandpa, what had he been doing for the ten years since his wife died?",
        "gold_chunk_ids": ["9037f30c-acd3-5136-ae0c-cc3a54962f0a"],
    },
    {
        "id": "vitaminm_05",
        "chapter": "Vitamin-M",
        "question": "What game does Grandpa play very well with Ravi, and what historic matches does he reference while playing?",
        "gold_chunk_ids": ["377dfa3d-17df-5088-a356-2f6f860b1b1d"],
    },
    {
        "id": "vitaminm_06",
        "chapter": "Vitamin-M",
        "question": "What excuse does Grandpa use to leave the house on his own, in Part I of the story?",
        "gold_chunk_ids": ["377dfa3d-17df-5088-a356-2f6f860b1b1d"],
    },
    {
        "id": "vitaminm_07",
        "chapter": "Vitamin-M",
        "question": "What forbidden items does Grandpa consume at the tea stall that he is not allowed to have at home?",
        "gold_chunk_ids": ["c1994a5d-f5e9-50db-a022-744554e7c806"],
    },
    {
        "id": "vitaminm_08",
        "chapter": "Vitamin-M",
        "question": "What embarrassing mix-up does Ravi discover on the bus while following the man in the yellow cap?",
        "gold_chunk_ids": ["1f50d8e2-1cfb-5fc4-8198-146d1d246e8e", "c7415728-fbfb-5355-832d-31807d4bdc51"],
    },
    {
        "id": "vitaminm_09",
        "chapter": "Vitamin-M",
        "question": "What does Ravi find when he finally returns home worried about Grandpa?",
        "gold_chunk_ids": ["a4a7b748-ca93-521d-8ee1-1c5dd55c302f"],
    },
    {
        "id": "vitaminm_10",
        "chapter": "Vitamin-M",
        "question": "What gift does Grandpa give Ravi, and why does he say he is giving it, even though it is not Ravi's birthday?",
        "gold_chunk_ids": ["d50bcd6d-5fc2-58b5-941b-819d7d6568c2", "66b22c17-3ebb-5fd6-8677-8b8f95208104"],
    },
    {
        "id": "vitaminm_11",
        "chapter": "Vitamin-M",
        "question": "What comment does Grandpa make to Ravi's father about Ravi's mother needing 'Vitamin-M'?",
        "gold_chunk_ids": ["d50bcd6d-5fc2-58b5-941b-819d7d6568c2"],
    },
    {
        "id": "vitaminm_12",
        "chapter": "Vitamin-M",
        "question": "Who is the author credited for the story 'Vitamin-M'?",
        "gold_chunk_ids": ["66b22c17-3ebb-5fd6-8677-8b8f95208104"],
    },
    {
        "id": "vitaminm_13",
        "chapter": "Vitamin-M",
        "question": "In 'The Lost Child', what things does the child ask for as he walks with his parents through the fair, which they refuse to buy him?",
        "gold_chunk_ids": ["60ca5a23-394c-552c-a32d-74863a9909fc", "8cf62d9e-f5f4-5fc0-9479-4a039d2474e6"],
    },
    {
        "id": "vitaminm_14",
        "chapter": "Vitamin-M",
        "question": "In 'The Lost Child', what does the child finally ask for right before he realises he has become separated from his parents?",
        "gold_chunk_ids": ["01ad38be-4559-58aa-98c2-5fdb3c08c967"],
    },
    {
        "id": "vitaminm_15",
        "chapter": "Vitamin-M",
        "question": "In 'The Lost Child', who finds the boy after he is separated from his parents, and what things does he offer to comfort him?",
        "gold_chunk_ids": ["16e9cba7-6bfd-5d6a-98c8-c6c1be956e3e"],
    },
    {
        "id": "vitaminm_16",
        "chapter": "Vitamin-M",
        "question": "In 'The Lost Child', what does the child repeatedly say in response to every offer the stranger makes to comfort him?",
        "gold_chunk_ids": ["16e9cba7-6bfd-5d6a-98c8-c6c1be956e3e", "d244366b-a60e-50bf-91da-e0508a096e57"],
    },
    {
        "id": "vitaminm_17",
        "chapter": "Vitamin-M",
        "question": "Who is the author credited for 'The Lost Child'?",
        "gold_chunk_ids": ["d244366b-a60e-50bf-91da-e0508a096e57"],
    },
    {
        "id": "vitaminm_18",
        "chapter": "Vitamin-M",
        "question": "In 'The Lost Child', what happened when the child tried to catch a dragonfly in the mustard field?",
        "gold_chunk_ids": ["60ca5a23-394c-552c-a32d-74863a9909fc"],
    },
    {
        "id": "vitaminm_19",
        "chapter": "Vitamin-M",
        "question": "In 'The Lost Child', how is the snake-charmer's music described as it plays to the swaying cobra?",
        "gold_chunk_ids": ["8cf62d9e-f5f4-5fc0-9479-4a039d2474e6"],
    },
]

# Chapter: "I Cannot Remember My Mother" (English, Class 9) - poem by Rabindranath Tagore, plus "I Remember, I Remember" by Thomas Hood

GOLD_QUESTIONS += [
    {
        "id": "mother_01",
        "chapter": "I Cannot Remember My Mother",
        "question": "Who wrote the poem 'I Cannot Remember My Mother'?",
        "gold_chunk_ids": ["33ae5fc1-4bed-5c8b-bd36-99db7b62779a"],
    },
    {
        "id": "mother_02",
        "chapter": "I Cannot Remember My Mother",
        "question": "In the first stanza, when does the poet feel he remembers his mother?",
        "gold_chunk_ids": ["33ae5fc1-4bed-5c8b-bd36-99db7b62779a"],
    },
    {
        "id": "mother_03",
        "chapter": "I Cannot Remember My Mother",
        "question": "According to the second stanza, what smells remind the poet of his mother?",
        "gold_chunk_ids": ["33ae5fc1-4bed-5c8b-bd36-99db7b62779a"],
    },
    {
        "id": "mother_04",
        "chapter": "I Cannot Remember My Mother",
        "question": "According to the third stanza, what does the poet feel when he looks into the sky from his bedroom window?",
        "gold_chunk_ids": ["33ae5fc1-4bed-5c8b-bd36-99db7b62779a"],
    },
    {
        "id": "mother_05",
        "chapter": "I Cannot Remember My Mother",
        "question": "How is a refrain defined in the chapter, and which line serves as the refrain of the poem?",
        "gold_chunk_ids": ["8f8f7ac9-d3b4-5f1a-9d18-0b4d2f161365"],
    },
    {
        "id": "mother_06",
        "chapter": "I Cannot Remember My Mother",
        "question": "How is symbolism defined in the chapter?",
        "gold_chunk_ids": ["8f8f7ac9-d3b4-5f1a-9d18-0b4d2f161365"],
    },
    {
        "id": "mother_07",
        "chapter": "I Cannot Remember My Mother",
        "question": "According to the passage adapted from Sarojini Naidu, what images are used to describe a March morning?",
        "gold_chunk_ids": ["6b6a38b5-3806-50e0-bdfa-1eb380891941"],
    },
    {
        "id": "mother_08",
        "chapter": "I Cannot Remember My Mother",
        "question": "Who wrote the poem 'I Remember, I Remember' given as additional reading in the chapter?",
        "gold_chunk_ids": ["6afa1f6f-cb07-52ec-a665-824d0b6723b1"],
    },
    {
        "id": "mother_09",
        "chapter": "I Cannot Remember My Mother",
        "question": "In Thomas Hood's poem 'I Remember, I Remember', what does the poet remember about the house where he was born?",
        "gold_chunk_ids": ["6afa1f6f-cb07-52ec-a665-824d0b6723b1"],
    },
    {
        "id": "mother_10",
        "chapter": "I Cannot Remember My Mother",
        "question": "According to the chapter, what are some facts mentioned about shiuli flowers?",
        "gold_chunk_ids": ["5ba9dff7-70e5-5847-86fc-df3e09977a46"],
    },
    {
        "id": "mother_11",
        "chapter": "I Cannot Remember My Mother",
        "question": "According to the chapter, why did Anne Frank and Zlata Filipovic begin their diary entries with 'Dear diary', unlike Samuel Pepys?",
        "gold_chunk_ids": ["5ba9dff7-70e5-5847-86fc-df3e09977a46"],
    },
]

# Chapter: "Nine Gold Medals" (English, Class 9) - poem by David Roth

GOLD_QUESTIONS += [
    {
        "id": "ninegold_01",
        "chapter": "Nine Gold Medals",
        "question": "Who is the poet of 'Nine Gold Medals'?",
        "gold_chunk_ids": ["cff1f78d-e836-5853-b736-5583b71d0e0a"],
    },
    {
        "id": "ninegold_02",
        "chapter": "Nine Gold Medals",
        "question": "What happened to the smallest athlete when the race began, according to the poem?",
        "gold_chunk_ids": ["87143bf6-7abc-5084-953c-ddf40fe2ff93"],
    },
    {
        "id": "ninegold_03",
        "chapter": "Nine Gold Medals",
        "question": "How did the other eight runners react when one athlete fell during the race?",
        "gold_chunk_ids": ["cff1f78d-e836-5853-b736-5583b71d0e0a"],
    },
    {
        "id": "ninegold_04",
        "chapter": "Nine Gold Medals",
        "question": "How did the race end, according to the final stanza of the poem?",
        "gold_chunk_ids": ["cff1f78d-e836-5853-b736-5583b71d0e0a"],
    },
    {
        "id": "ninegold_05",
        "chapter": "Nine Gold Medals",
        "question": "What banner was displayed above the race, and what event did the poem's final stanzas describe it as representing?",
        "gold_chunk_ids": ["cff1f78d-e836-5853-b736-5583b71d0e0a"],
    },
    {
        "id": "ninegold_06",
        "chapter": "Nine Gold Medals",
        "question": "According to the listening exercise about the radio-talk, what event did Patrick Gomes mostly participate in as a special athlete, and what is his role now?",
        "gold_chunk_ids": ["4bb511e3-9e15-5197-933b-04592ace8760"],
    },
    {
        "id": "ninegold_07",
        "chapter": "Nine Gold Medals",
        "question": "According to the chapter, what did Ravimathi Arumugam achieve at the Special Olympic Games 2023 in Berlin?",
        "gold_chunk_ids": ["b6b52129-0ba3-5a0a-ba85-5c8373aef01c"],
    },
    {
        "id": "ninegold_08",
        "chapter": "Nine Gold Medals",
        "question": "According to the chapter, what did Saket Kundu achieve at the Special Olympic Games 2023 in Berlin?",
        "gold_chunk_ids": ["b6b52129-0ba3-5a0a-ba85-5c8373aef01c"],
    },
    {
        "id": "ninegold_09",
        "chapter": "Nine Gold Medals",
        "question": "According to the infographic in the chapter, what does the Olympic motto 'Citius-Altius-Fortius-Communiter' translate to?",
        "gold_chunk_ids": ["178a0f06-7537-515b-bd30-8523a2f105e1"],
    },
    {
        "id": "ninegold_10",
        "chapter": "Nine Gold Medals",
        "question": "According to the infographic, what does the Special Olympics provide, and what is its purpose?",
        "gold_chunk_ids": ["178a0f06-7537-515b-bd30-8523a2f105e1"],
    },
    {
        "id": "ninegold_11",
        "chapter": "Nine Gold Medals",
        "question": "In what year did the first Olympic Games take place, according to the infographic in the chapter?",
        "gold_chunk_ids": ["178a0f06-7537-515b-bd30-8523a2f105e1"],
    },
    {
        "id": "ninegold_12",
        "chapter": "Nine Gold Medals",
        "question": "What is the meaning of the word 'asphalt' as given in the vocabulary matching exercise in the chapter?",
        "gold_chunk_ids": ["0f72ad2c-2a40-50f0-b858-7bb1ca2be5a1"],
    },
    {
        "id": "ninegold_13",
        "chapter": "Nine Gold Medals",
        "question": "What example slogan on Special Olympics is given in the Writing Task of the chapter?",
        "gold_chunk_ids": ["95f2b6b0-3afe-582d-bfd6-607b6ef1e92d"],
    },
]

# Chapter: "The World of Limitless Possibilities" (English, Class 9) - interview with Paralympian Dr. Deepa Malik

GOLD_QUESTIONS += [
    {
        "id": "limitless_01",
        "chapter": "The World of Limitless Possibilities",
        "question": "In what year did Bharat make its debut in the Paralympics, and when was the first medal won?",
        "gold_chunk_ids": ["6d8f3a14-586b-5f17-b914-65eba1a9aff7"],
    },
    {
        "id": "limitless_02",
        "chapter": "The World of Limitless Possibilities",
        "question": "Who is Dr. Deepa Malik, and what awards has she received according to the chapter?",
        "gold_chunk_ids": ["6d8f3a14-586b-5f17-b914-65eba1a9aff7"],
    },
    {
        "id": "limitless_03",
        "chapter": "The World of Limitless Possibilities",
        "question": "At what age was Dr. Deepa Malik diagnosed with a spine tumour, and what was the outcome of her surgery?",
        "gold_chunk_ids": ["6d8f3a14-586b-5f17-b914-65eba1a9aff7"],
    },
    {
        "id": "limitless_04",
        "chapter": "The World of Limitless Possibilities",
        "question": "What two choices did Dr. Deepa Malik say she had after being told she would be bound to a wheelchair?",
        "gold_chunk_ids": ["6d8f3a14-586b-5f17-b914-65eba1a9aff7"],
    },
    {
        "id": "limitless_05",
        "chapter": "The World of Limitless Possibilities",
        "question": "What was Dr. Deepa Malik's breakthrough moment in her para-athletics career, according to the interview?",
        "gold_chunk_ids": ["4d0be9cd-557b-5ed7-993f-d1c04a414da9"],
    },
    {
        "id": "limitless_06",
        "chapter": "The World of Limitless Possibilities",
        "question": "What sporting 'firsts' does Dr. Deepa Malik hold, according to the interview?",
        "gold_chunk_ids": ["4d0be9cd-557b-5ed7-993f-d1c04a414da9"],
    },
    {
        "id": "limitless_07",
        "chapter": "The World of Limitless Possibilities",
        "question": "What school of thought does Dr. Deepa Malik say she is a proponent of?",
        "gold_chunk_ids": ["4d0be9cd-557b-5ed7-993f-d1c04a414da9"],
    },
    {
        "id": "limitless_08",
        "chapter": "The World of Limitless Possibilities",
        "question": "According to Dr. Deepa Malik, what was one of the most significant challenges she faced in her journey?",
        "gold_chunk_ids": ["01c636d4-0885-580c-b4be-48fef646392f"],
    },
    {
        "id": "limitless_09",
        "chapter": "The World of Limitless Possibilities",
        "question": "According to Dr. Deepa Malik, what has Paralympics given her, and how has it changed her life?",
        "gold_chunk_ids": ["01c636d4-0885-580c-b4be-48fef646392f"],
    },
    {
        "id": "limitless_10",
        "chapter": "The World of Limitless Possibilities",
        "question": "What causes does Dr. Deepa Malik say she supports as part of her advocacy work?",
        "gold_chunk_ids": ["552239b7-85a7-5f6e-aecf-61c330ccca60"],
    },
    {
        "id": "limitless_11",
        "chapter": "The World of Limitless Possibilities",
        "question": "What advice does Dr. Deepa Malik give to individuals facing challenges or setbacks?",
        "gold_chunk_ids": ["552239b7-85a7-5f6e-aecf-61c330ccca60"],
    },
    {
        "id": "limitless_12",
        "chapter": "The World of Limitless Possibilities",
        "question": "According to the chapter, in what year and by whom was the origin of the Paralympics traced back, and what were the Stoke Mandeville Games?",
        "gold_chunk_ids": ["e49e8ca0-a82f-5b32-829f-11fe007f3c70"],
    },
    {
        "id": "limitless_13",
        "chapter": "The World of Limitless Possibilities",
        "question": "According to the chapter, where and when was the Stoke Mandeville Games (the Olympic-style games for differently-abled athletes) first organised?",
        "gold_chunk_ids": ["e49e8ca0-a82f-5b32-829f-11fe007f3c70"],
    },
    {
        "id": "limitless_14",
        "chapter": "The World of Limitless Possibilities",
        "question": "According to the chapter, how are the Paralympics divided, and how often do they occur?",
        "gold_chunk_ids": ["e49e8ca0-a82f-5b32-829f-11fe007f3c70"],
    },
    {
        "id": "limitless_15",
        "chapter": "The World of Limitless Possibilities",
        "question": "Who is Sheetal Devi, as introduced in the chapter's opening Reflect and Respond section?",
        "gold_chunk_ids": ["cc15048c-735c-5675-a9ee-9d725a38a1ea"],
    },
    {
        "id": "limitless_16",
        "chapter": "The World of Limitless Possibilities",
        "question": "According to the interview, how has the International Paralympic Committee ranked Dr. Deepa Malik among women para-athletes globally?",
        "gold_chunk_ids": ["6d8f3a14-586b-5f17-b914-65eba1a9aff7"],
    },
]

# Chapter: "Twin Melodies" (English, Class 9) - play by Mitra Phukan

GOLD_QUESTIONS += [
    {
        "id": "twinmelodies_01",
        "chapter": "Twin Melodies",
        "question": "Who wrote the play 'Twin Melodies'?",
        "gold_chunk_ids": ["2541547b-0a24-5b07-957c-8be5dd57b5d9"],
    },
    {
        "id": "twinmelodies_02",
        "chapter": "Twin Melodies",
        "question": "Who are the five characters listed at the start of the play 'Twin Melodies', and what instrument does each play?",
        "gold_chunk_ids": ["247d62a6-8c12-591a-bf89-ca102c1b4a68"],
    },
    {
        "id": "twinmelodies_03",
        "chapter": "Twin Melodies",
        "question": "According to the newspaper article Iqbal reads aloud in Act I, what does it say about Shruti Sharma?",
        "gold_chunk_ids": ["f861df63-98ac-5eb6-a549-f0229e05edd2"],
    },
    {
        "id": "twinmelodies_04",
        "chapter": "Twin Melodies",
        "question": "Why is Shruti hesitant to tell her father about the Indo-Western fusion concert, according to Act I?",
        "gold_chunk_ids": ["03ee5d71-2384-5cd0-89e6-f3bf24c7fa68"],
    },
    {
        "id": "twinmelodies_05",
        "chapter": "Twin Melodies",
        "question": "What is Nabin Sharma's rule about performances, as stated in Act II?",
        "gold_chunk_ids": ["2676646a-60e9-5490-9233-4e43f1b8318d"],
    },
    {
        "id": "twinmelodies_06",
        "chapter": "Twin Melodies",
        "question": "How does Nabin Sharma initially react when Shruti tells him about the Indo-Western fusion concert?",
        "gold_chunk_ids": ["2676646a-60e9-5490-9233-4e43f1b8318d", "53fab1e4-32f1-52fa-9a13-46d782e5c725"],
    },
    {
        "id": "twinmelodies_07",
        "chapter": "Twin Melodies",
        "question": "What happens in Act III when Shruti's parents enter the room during the group's rehearsal?",
        "gold_chunk_ids": ["aef88c1b-ad21-5f97-82a1-4fc6189b3879"],
    },
    {
        "id": "twinmelodies_08",
        "chapter": "Twin Melodies",
        "question": "According to Leela in Act III, why did Shruti's grandfather see Nabin's choice to play the violin as a kind of betrayal?",
        "gold_chunk_ids": ["836c58d3-5eb5-5c58-bdb3-820c82faa59f", "2541547b-0a24-5b07-957c-8be5dd57b5d9"],
    },
    {
        "id": "twinmelodies_09",
        "chapter": "Twin Melodies",
        "question": "What does Nabin say at the end of the play about his own fears regarding Shruti's fusion music?",
        "gold_chunk_ids": ["2541547b-0a24-5b07-957c-8be5dd57b5d9"],
    },
    {
        "id": "twinmelodies_10",
        "chapter": "Twin Melodies",
        "question": "What theatrical device is 'aside' explained to be in the chapter's Vocabulary section?",
        "gold_chunk_ids": ["ab57e27b-b169-5ba1-acbd-769167dd9239"],
    },
    {
        "id": "twinmelodies_11",
        "chapter": "Twin Melodies",
        "question": "What are non-lexical fillers, as explained in the chapter, and what examples from the text are given?",
        "gold_chunk_ids": ["c008529a-170c-5699-b09b-64f57896f0ce"],
    },
    {
        "id": "twinmelodies_12",
        "chapter": "Twin Melodies",
        "question": "According to the vocabulary matching table, what does 'crescendo' mean?",
        "gold_chunk_ids": ["a732fed1-174a-56be-9d31-e1bee8e2ac0f", "247d62a6-8c12-591a-bf89-ca102c1b4a68"],
    },
    {
        "id": "twinmelodies_13",
        "chapter": "Twin Melodies",
        "question": "What is the Recycled Orchestra of Cateura, Paraguay, according to the chapter's 'Did you know' section?",
        "gold_chunk_ids": ["a1c29846-de75-5250-940b-7ccc82d6e35e"],
    },
    {
        "id": "twinmelodies_14",
        "chapter": "Twin Melodies",
        "question": "According to the chapter, what materials are indigenous musical instruments typically crafted from?",
        "gold_chunk_ids": ["4909e500-665d-537e-828a-6ea42bca5993"],
    },
    {
        "id": "twinmelodies_15",
        "chapter": "Twin Melodies",
        "question": "What collection of plays by Sai Paranjpye is recommended in the chapter, and what does the play 'Rigmarole' follow?",
        "gold_chunk_ids": ["4909e500-665d-537e-828a-6ea42bca5993"],
    },
    {
        "id": "twinmelodies_16",
        "chapter": "Twin Melodies",
        "question": "According to the chapter, why are inverted commas not used to convey dialogue in a play script, and what is written within brackets instead?",
        "gold_chunk_ids": ["a1c29846-de75-5250-940b-7ccc82d6e35e"],
    },
    {
        "id": "twinmelodies_17",
        "chapter": "Twin Melodies",
        "question": "In the Writing Task, who is Anuradha, and what conflict does she face regarding her father?",
        "gold_chunk_ids": ["347de4c3-ce05-58d0-8020-0e03d8767372"],
    },
]

# Chapter: "A Friend Found in Music" (English, Class 9) - poem by Bryanna T. Perkins

GOLD_QUESTIONS += [
    {
        "id": "friendmusic_01",
        "chapter": "A Friend Found in Music",
        "question": "According to the poem, what does the poet compare music to in its opening lines?",
        "gold_chunk_ids": ["0ae0f303-d35f-5449-aec8-02736ea2626f"],
    },
    {
        "id": "friendmusic_02",
        "chapter": "A Friend Found in Music",
        "question": "Who is credited as the poet of the reading poem in 'A Friend Found in Music'?",
        "gold_chunk_ids": ["0ae0f303-d35f-5449-aec8-02736ea2626f"],
    },
    {
        "id": "friendmusic_03",
        "chapter": "A Friend Found in Music",
        "question": "According to the poem, what does the poet say music does for her when she feels 'blue'?",
        "gold_chunk_ids": ["0ae0f303-d35f-5449-aec8-02736ea2626f"],
    },
    {
        "id": "friendmusic_04",
        "chapter": "A Friend Found in Music",
        "question": "What is the meaning of the phrasal verb 'pull through' as explained in the vocabulary section of the chapter?",
        "gold_chunk_ids": ["c26041c2-c122-53f1-9add-1e58acecc458"],
    },
    {
        "id": "friendmusic_05",
        "chapter": "A Friend Found in Music",
        "question": "According to the poem 'Music' by Walter De la Mare, what happens to the earth and its 'lovely things' when music sounds?",
        "gold_chunk_ids": ["c04b92f9-326c-5fcf-bba3-c19b10070801"],
    },
    {
        "id": "friendmusic_06",
        "chapter": "A Friend Found in Music",
        "question": "Who wrote the poem 'Music', given as additional reading in the chapter?",
        "gold_chunk_ids": ["c04b92f9-326c-5fcf-bba3-c19b10070801"],
    },
    {
        "id": "friendmusic_07",
        "chapter": "A Friend Found in Music",
        "question": "In the listening exercise conversation, which musical instrument is identified as the reason for the problem being discussed?",
        "gold_chunk_ids": ["88f0ca67-774f-567d-b426-db5406ceb702"],
    },
    {
        "id": "friendmusic_08",
        "chapter": "A Friend Found in Music",
        "question": "According to the chapter, what do the ancient texts Raga Chikitsa and Sangita Sudha describe about music?",
        "gold_chunk_ids": ["311e6fea-fe8a-59b6-b79f-0fc94ca056cf"],
    },
    {
        "id": "friendmusic_09",
        "chapter": "A Friend Found in Music",
        "question": "What is the occasion for which the student is asked to draft an invitation letter to their grandparents in the Writing Task?",
        "gold_chunk_ids": ["311e6fea-fe8a-59b6-b79f-0fc94ca056cf", "54830b47-2b5a-5714-a965-a24a8aa78909"],
    },
]

# Chapter: "Words" (English, Class 9) - poem by Charles Swain, plus "Weigh Your Words" by E.F. Hayward

GOLD_QUESTIONS += [
    {
        "id": "words_01",
        "chapter": "Words",
        "question": "Who is the poet of the poem 'Words' (beginning 'If words could satisfy the heart')?",
        "gold_chunk_ids": ["0015320f-c19c-52d6-b9cc-89e80fd16cc2"],
    },
    {
        "id": "words_02",
        "chapter": "Words",
        "question": "According to the poem, what are words compared to that 'depart, and leave but empty air'?",
        "gold_chunk_ids": ["624939c7-661b-5cd9-b7d7-5e779c4e1f31"],
    },
    {
        "id": "words_03",
        "chapter": "Words",
        "question": "According to the poem, what does the heart, described as 'a pilgrim upon earth', often find when it needs words?",
        "gold_chunk_ids": ["624939c7-661b-5cd9-b7d7-5e779c4e1f31"],
    },
    {
        "id": "words_04",
        "chapter": "Words",
        "question": "According to the final stanza of the poem, what happens when 'the voice that wins its sunny way' speaks?",
        "gold_chunk_ids": ["624939c7-661b-5cd9-b7d7-5e779c4e1f31"],
    },
    {
        "id": "words_05",
        "chapter": "Words",
        "question": "According to the poem, what would happen 'if words could satisfy the chest'?",
        "gold_chunk_ids": ["0015320f-c19c-52d6-b9cc-89e80fd16cc2"],
    },
    {
        "id": "words_06",
        "chapter": "Words",
        "question": "What quotation about words and the heart, given in the Speaking Activity, is attributed to Mahatma Gandhi?",
        "gold_chunk_ids": ["a171d250-b2ff-5c41-9d8d-c0721a412dc6"],
    },
    {
        "id": "words_07",
        "chapter": "Words",
        "question": "What quotation about the path from dreams to success is attributed to Kalpana Chawla in the chapter?",
        "gold_chunk_ids": ["a171d250-b2ff-5c41-9d8d-c0721a412dc6"],
    },
    {
        "id": "words_08",
        "chapter": "Words",
        "question": "Who is recognised as 'The Father of Sign Language and Deaf Education' according to the chapter?",
        "gold_chunk_ids": ["03c96800-79a7-598c-a32d-08a98d19bf8c"],
    },
    {
        "id": "words_09",
        "chapter": "Words",
        "question": "What is Dumb Charades, as described in the chapter?",
        "gold_chunk_ids": ["03c96800-79a7-598c-a32d-08a98d19bf8c"],
    },
    {
        "id": "words_10",
        "chapter": "Words",
        "question": "Who wrote the poem 'Weigh Your Words'?",
        "gold_chunk_ids": ["03c96800-79a7-598c-a32d-08a98d19bf8c"],
    },
    {
        "id": "words_11",
        "chapter": "Words",
        "question": "According to the poem 'Weigh Your Words', what would happen if we 'weigh' each word before speaking?",
        "gold_chunk_ids": ["03c96800-79a7-598c-a32d-08a98d19bf8c"],
    },
]

# Chapter: "Carrier of Words" (English, Class 9) - profile of Khetaram, a Gramin Dak Sewak

GOLD_QUESTIONS += [
    {
        "id": "carrierwords_01",
        "chapter": "Carrier of Words",
        "question": "Who is Khetaram, and what is his role at the Somarad Branch Post Office?",
        "gold_chunk_ids": ["e8035236-04d3-594f-a790-d59ce6fe178c", "d9a4d88c-6390-5498-afaf-e42ab0e9054e"],
    },
    {
        "id": "carrierwords_02",
        "chapter": "Carrier of Words",
        "question": "How far is Khetaram's delivery area from the last railhead and the last phone line, according to the chapter?",
        "gold_chunk_ids": ["95d8e0cb-e6a4-5794-9471-2aa139a45835"],
    },
    {
        "id": "carrierwords_03",
        "chapter": "Carrier of Words",
        "question": "What is the maximum weight regulation for Khetaram's mailbag, according to the chapter?",
        "gold_chunk_ids": ["95d8e0cb-e6a4-5794-9471-2aa139a45835"],
    },
    {
        "id": "carrierwords_04",
        "chapter": "Carrier of Words",
        "question": "Why does Khetaram's body register the temperature as 49.9 degrees Celsius instead of 50, according to the chapter?",
        "gold_chunk_ids": ["95d8e0cb-e6a4-5794-9471-2aa139a45835"],
    },
    {
        "id": "carrierwords_05",
        "chapter": "Carrier of Words",
        "question": "Until what year was Khetaram known as a 'delivery agent', and what were such workers renamed as?",
        "gold_chunk_ids": ["0c65869e-50f0-55f8-961e-22912cc2393d"],
    },
    {
        "id": "carrierwords_06",
        "chapter": "Carrier of Words",
        "question": "According to the chapter, what percentage of India Post's total workforce do Gramin Dak Sewaks (GDS) constitute?",
        "gold_chunk_ids": ["0c65869e-50f0-55f8-961e-22912cc2393d"],
    },
    {
        "id": "carrierwords_07",
        "chapter": "Carrier of Words",
        "question": "According to the Postmaster-General of Rajasthan Western Region, why is the role of GDS described as 'invaluable'?",
        "gold_chunk_ids": ["0c65869e-50f0-55f8-961e-22912cc2393d"],
    },
    {
        "id": "carrierwords_08",
        "chapter": "Carrier of Words",
        "question": "How many post offices did India have in 1947 compared to today, according to the chapter?",
        "gold_chunk_ids": ["4d9d783c-3932-5c49-83e7-0eac18ec9c01"],
    },
    {
        "id": "carrierwords_09",
        "chapter": "Carrier of Words",
        "question": "According to the chapter, what is the essential criterion for GDS selection, and until what age are they allowed to serve?",
        "gold_chunk_ids": ["6ca10402-231b-586e-8e8d-53e644937311"],
    },
    {
        "id": "carrierwords_10",
        "chapter": "Carrier of Words",
        "question": "What does Khetaram say about famine ('Akaal') and his family's food supply?",
        "gold_chunk_ids": ["6ca10402-231b-586e-8e8d-53e644937311"],
    },
    {
        "id": "carrierwords_11",
        "chapter": "Carrier of Words",
        "question": "According to Mulk Raj Anand's book 'Story of the Indian Post Office', what does Indians' dependence on the post office for money orders reflect?",
        "gold_chunk_ids": ["6ca10402-231b-586e-8e8d-53e644937311"],
    },
    {
        "id": "carrierwords_12",
        "chapter": "Carrier of Words",
        "question": "What happened when a scheme was proposed to scrap the GDS and transfer the job to patwaris (village record keepers)?",
        "gold_chunk_ids": ["6ca10402-231b-586e-8e8d-53e644937311"],
    },
    {
        "id": "carrierwords_13",
        "chapter": "Carrier of Words",
        "question": "What small tokens of gratitude does Khetaram receive from villagers and the BSF camp, according to the chapter?",
        "gold_chunk_ids": ["4445c52e-af0b-55f1-ab80-d34831201177"],
    },
    {
        "id": "carrierwords_14",
        "chapter": "Carrier of Words",
        "question": "What does the torn right corner of an envelope signify, and how does Khetaram handle delivering such news?",
        "gold_chunk_ids": ["4445c52e-af0b-55f1-ab80-d34831201177"],
    },
    {
        "id": "carrierwords_15",
        "chapter": "Carrier of Words",
        "question": "What might Khetaram become if phone lines reach within range, and what would his new role involve?",
        "gold_chunk_ids": ["ee7070e9-88a5-5057-805b-55bbef601dd5"],
    },
    {
        "id": "carrierwords_16",
        "chapter": "Carrier of Words",
        "question": "How is Khetaram protected against desert conditions during his rounds, and why does he only wipe his body instead of washing?",
        "gold_chunk_ids": ["0c65869e-50f0-55f8-961e-22912cc2393d"],
    },
    {
        "id": "carrierwords_17",
        "chapter": "Carrier of Words",
        "question": "According to the chapter's 'Did you know?' section, what is philately, and can a person be a philatelist without owning any stamps?",
        "gold_chunk_ids": ["876945b1-3f21-5553-a445-43c69e573a43"],
    },
    {
        "id": "carrierwords_18",
        "chapter": "Carrier of Words",
        "question": "What was the purpose of the 'Daakroom' carnival, and which organisations supported it, according to the chapter?",
        "gold_chunk_ids": ["876945b1-3f21-5553-a445-43c69e573a43"],
    },
]

# Chapter: "Follow That Dream" (English, Class 9) - letter by Irene Chua from 'My Daughter, My Friend'

GOLD_QUESTIONS += [
    {
        "id": "followdream_01",
        "chapter": "Follow That Dream",
        "question": "Who is the author of the letter excerpt in 'Follow That Dream', and what is the title of the book it is taken from?",
        "gold_chunk_ids": ["c49a8704-e881-55fe-a680-318bc99147aa"],
    },
    {
        "id": "followdream_02",
        "chapter": "Follow That Dream",
        "question": "According to the letter, how many years of singular and intensive pursuit does it typically take to reach a world-class standard in any field?",
        "gold_chunk_ids": ["c49a8704-e881-55fe-a680-318bc99147aa"],
    },
    {
        "id": "followdream_03",
        "chapter": "Follow That Dream",
        "question": "According to the letter, what differentiates greatness from the ordinary?",
        "gold_chunk_ids": ["c49a8704-e881-55fe-a680-318bc99147aa"],
    },
    {
        "id": "followdream_04",
        "chapter": "Follow That Dream",
        "question": "According to the letter, what keeps a person on track when 'stamina is running out'?",
        "gold_chunk_ids": ["4cb1fc99-d1e2-5025-a313-0bf626a208c9"],
    },
    {
        "id": "followdream_05",
        "chapter": "Follow That Dream",
        "question": "According to the letter, what example does the mother give about the Academy Awards to illustrate that success involves a support network?",
        "gold_chunk_ids": ["4cb1fc99-d1e2-5025-a313-0bf626a208c9"],
    },
    {
        "id": "followdream_06",
        "chapter": "Follow That Dream",
        "question": "According to the letter, what real historical event changed the destiny of people who had dreamed of attending Raffles College?",
        "gold_chunk_ids": ["fa630603-21af-5b3e-9051-45e3a9e213d7"],
    },
    {
        "id": "followdream_07",
        "chapter": "Follow That Dream",
        "question": "According to the letter, what personal dream does Irene Chua mention she had chased over the last ten years?",
        "gold_chunk_ids": ["fa630603-21af-5b3e-9051-45e3a9e213d7"],
    },
    {
        "id": "followdream_08",
        "chapter": "Follow That Dream",
        "question": "According to the vocabulary section, what does the compound word 'dreamscape' mean, and what does the suffix '-scape' mean?",
        "gold_chunk_ids": ["f7860eb8-3f0e-5dc6-99c6-d42f66100fb7"],
    },
    {
        "id": "followdream_09",
        "chapter": "Follow That Dream",
        "question": "What does the phrase 'burn in your blood' mean, according to the vocabulary exercise in the chapter?",
        "gold_chunk_ids": ["842b8332-37f3-5bfd-aa8a-48f2b328d545"],
    },
    {
        "id": "followdream_10",
        "chapter": "Follow That Dream",
        "question": "What does the idiom 'wet blanket' mean, according to the vocabulary exercise in the chapter?",
        "gold_chunk_ids": ["842b8332-37f3-5bfd-aa8a-48f2b328d545"],
    },
    {
        "id": "followdream_11",
        "chapter": "Follow That Dream",
        "question": "According to the letter, what should a person do if 'the burning conviction is still coursing through your veins' after considering all the obstacles?",
        "gold_chunk_ids": ["909e81c9-6951-5488-8965-55dcd851045f"],
    },
    {
        "id": "followdream_12",
        "chapter": "Follow That Dream",
        "question": "According to the chapter's Learning Beyond the Text section, what is a Vision Board and what does it help a person do?",
        "gold_chunk_ids": ["2593dc96-bc37-5d68-947d-ce315c805029"],
    },
    {
        "id": "followdream_13",
        "chapter": "Follow That Dream",
        "question": "According to the letter, what advice does the mother give about counting the 'cost' before pursuing a dream?",
        "gold_chunk_ids": ["c49a8704-e881-55fe-a680-318bc99147aa"],
    },
]

# Chapter: "Believe in Yourself" (English, Class 9) - poem by Robert Langley, plus "Always Believe in Yourself" by Dorothy Hewitt

GOLD_QUESTIONS += [
    {
        "id": "believe_01",
        "chapter": "Believe in Yourself",
        "question": "Who is the poet of 'Believe in Yourself' (beginning 'Step up to the challenge')?",
        "gold_chunk_ids": ["97eb008d-51d8-562d-925e-6fa05612c4fa"],
    },
    {
        "id": "believe_02",
        "chapter": "Believe in Yourself",
        "question": "According to the poem, what does the poet say we are not made for, if we choose the ease of comfort and the status quo?",
        "gold_chunk_ids": ["97eb008d-51d8-562d-925e-6fa05612c4fa"],
    },
    {
        "id": "believe_03",
        "chapter": "Believe in Yourself",
        "question": "According to the final stanza of the poem, what is the hardest step, and what do you need to move forward?",
        "gold_chunk_ids": ["97eb008d-51d8-562d-925e-6fa05612c4fa"],
    },
    {
        "id": "believe_04",
        "chapter": "Believe in Yourself",
        "question": "What does the Latin expression 'status quo' mean, as explained in the vocabulary section of the chapter?",
        "gold_chunk_ids": ["f948e2c1-cabd-5a35-a270-06d293ea343b"],
    },
    {
        "id": "believe_05",
        "chapter": "Believe in Yourself",
        "question": "What is a rhetorical question, according to the definition given in the chapter?",
        "gold_chunk_ids": ["df04d813-0d04-56c6-8c9e-d986120a0759"],
    },
    {
        "id": "believe_06",
        "chapter": "Believe in Yourself",
        "question": "According to the chapter, what challenges did Dr. B. R. Ambedkar face at school, and what did he go on to achieve?",
        "gold_chunk_ids": ["281090e6-fc84-5957-bb71-2b4049ea8136"],
    },
    {
        "id": "believe_07",
        "chapter": "Believe in Yourself",
        "question": "According to the chapter, what hardships did Lal Bahadur Shastri endure in his early life, and what title was he honoured with after graduating?",
        "gold_chunk_ids": ["281090e6-fc84-5957-bb71-2b4049ea8136"],
    },
    {
        "id": "believe_08",
        "chapter": "Believe in Yourself",
        "question": "According to the chapter, what role did Lal Bahadur Shastri go on to hold after India's independence?",
        "gold_chunk_ids": ["c097c4c4-8db4-557b-a238-f7b59494e201"],
    },
    {
        "id": "believe_09",
        "chapter": "Believe in Yourself",
        "question": "According to the chapter, how did Dr. APJ Abdul Kalam help support his education as a child?",
        "gold_chunk_ids": ["c097c4c4-8db4-557b-a238-f7b59494e201"],
    },
    {
        "id": "believe_10",
        "chapter": "Believe in Yourself",
        "question": "Who wrote the poem 'Always Believe in Yourself' given as additional reading in the chapter?",
        "gold_chunk_ids": ["4eba2d15-be63-5368-9be1-fa6741627613"],
    },
    {
        "id": "believe_11",
        "chapter": "Believe in Yourself",
        "question": "According to the poem 'Always Believe in Yourself', what does the poet say you already have that you need to attain what you are after?",
        "gold_chunk_ids": ["4eba2d15-be63-5368-9be1-fa6741627613"],
    },
    {
        "id": "believe_12",
        "chapter": "Believe in Yourself",
        "question": "How does the chapter define antithesis, and what example does it give from Neil Armstrong's moon landing quote?",
        "gold_chunk_ids": ["29ec4aa1-8419-516c-89cb-6fb2c2a2696f"],
    },
    {
        "id": "believe_13",
        "chapter": "Believe in Yourself",
        "question": "Which two proverbs are given in the Speaking Activity for the role play in the chapter?",
        "gold_chunk_ids": ["a62d797e-18e3-5af6-8832-df781a963d0a"],
    },
]
