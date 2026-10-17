# -*- coding: utf-8 -*-
# Gold question set for the NCERT-RAG-Eval-style benchmark, built against
# the REAL local RAGProductionApp corpus (Qdrant "docs" collection).
# Each question is hand-written from actually reading the source chunk
# text (not synthetic/templated), with gold chunk id(s) recorded exactly
# as they exist in Qdrant today.
#
# Chapter: "दो बैलों की कथा" (Premchand's "The Tale of Two Bullocks",
# Hindi, Class 9) — 64 chunks. Mix of question types (factual, why/how
# comprehension, character-based, true/false, thematic), not just
# definition-recall, per explicit feedback to diversify question types.

GOLD_QUESTIONS = []

GOLD_QUESTIONS += [
    {
        "id": "hindi_bailon_01",
        "chapter": "दो बैलों की कथा",
        "question": "'दो बैलों की कथा' के लेखक कौन हैं, और उनका मूल नाम क्या था?",
        "gold_chunk_ids": ["436a6b63-a2d2-58f4-aed1-04472cc64629"],
    },
    {
        "id": "hindi_bailon_02",
        "chapter": "दो बैलों की कथा",
        "question": "प्रेमचंद का जन्म किस वर्ष और किस स्थान पर हुआ था?",
        "gold_chunk_ids": ["436a6b63-a2d2-58f4-aed1-04472cc64629"],
    },
    {
        "id": "hindi_bailon_03",
        "chapter": "दो बैलों की कथा",
        "question": "प्रेमचंद की कहानियाँ किस आठ भागों वाले संकलन में संकलित हैं?",
        "gold_chunk_ids": ["436a6b63-a2d2-58f4-aed1-04472cc64629"],
    },
    {
        "id": "hindi_bailon_04",
        "chapter": "दो बैलों की कथा",
        "question": "प्रेमचंद का निधन किस वर्ष हुआ था?",
        "gold_chunk_ids": ["5198979d-d042-5e89-b665-69b7b0214848"],
    },
    {
        "id": "hindi_bailon_05",
        "chapter": "दो बैलों की कथा",
        "question": "कहानी में दोनों बैलों के नाम क्या हैं, और उनके मालिक का नाम क्या है?",
        "gold_chunk_ids": ["766284b3-bedc-5f1e-b628-c45d6953b667"],
    },
    {
        "id": "hindi_bailon_06",
        "chapter": "दो बैलों की कथा",
        "question": "हीरा और मोती किस जाति के बैल थे?",
        "gold_chunk_ids": ["766284b3-bedc-5f1e-b628-c45d6953b667"],
    },
    {
        "id": "hindi_bailon_07",
        "chapter": "दो बैलों की कथा",
        "question": "गया के घर पहुँचने पर दोनों बैलों ने नाँद में मुँह क्यों नहीं डाला, जबकि वे दिन-भर के भूखे थे?",
        "gold_chunk_ids": ["247f0352-bf01-5aab-9a35-4ba2d677b1a7"],
    },
    {
        "id": "hindi_bailon_08",
        "chapter": "दो बैलों की कथा",
        "question": "हीरा और मोती रात में गया के घर से किस तरह भाग निकले?",
        "gold_chunk_ids": ["221a8922-3f81-57e0-8038-dc5f5603e105"],
    },
    {
        "id": "hindi_bailon_09",
        "chapter": "दो बैलों की कथा",
        "question": "हीरा और मोती ने मिलकर साँड़ को हराने के लिए क्या रणनीति अपनाई?",
        "gold_chunk_ids": ["091c3a61-01f7-5f47-9d60-46b64e7a0d05"],
    },
    {
        "id": "hindi_bailon_10",
        "chapter": "दो बैलों की कथा",
        "question": "कौन-सी छोटी लड़की दोनों बैलों को चुपके से रोटियाँ खिलाती थी, और उसे बैलों से अपनापन क्यों था?",
        "gold_chunk_ids": ["e13898ef-d183-5470-94b6-9f1732954245"],
    },
    {
        "id": "hindi_bailon_11",
        "chapter": "दो बैलों की कथा",
        "question": "हीरा और मोती को अंततः काँजीहौस (कांजीहाउस) क्यों ले जाया गया?",
        "gold_chunk_ids": ["3699ccd7-60bb-5027-bac6-9848ca78cb18"],
    },
    {
        "id": "hindi_bailon_12",
        "chapter": "दो बैलों की कथा",
        "question": "हीरा ने काँजीहौस की दीवार कैसे गिराई?",
        "gold_chunk_ids": ["6399cad3-fa7a-58fa-8fa6-f9695115600a", "e7f92a42-3f28-5e68-a4ad-994b3b052d85"],
    },
    {
        "id": "hindi_bailon_13",
        "chapter": "दो बैलों की कथा",
        "question": "दीवार गिरने के बाद कौन-से जानवर तुरंत भाग निकले, और कौन-से जानवर डर के मारे वहीं खड़े रहे?",
        "gold_chunk_ids": ["e7f92a42-3f28-5e68-a4ad-994b3b052d85"],
    },
    {
        "id": "hindi_bailon_14",
        "chapter": "दो बैलों की कथा",
        "question": "सच या झूठ: जब हीरा को चौकीदार ने पकड़कर बाँध दिया, तो मोती अकेला वहाँ से भाग गया और हीरा को छोड़ दिया।",
        "gold_chunk_ids": ["e7f92a42-3f28-5e68-a4ad-994b3b052d85", "eb57946a-c922-5fc7-84ec-f550a4c50caa"],
    },
    {
        "id": "hindi_bailon_15",
        "chapter": "दो बैलों की कथा",
        "question": "कहानी के 'समय और समाज' वाले भाग के अनुसार, यह कहानी परोक्ष रूप से किस ऐतिहासिक आंदोलन से जुड़ी है?",
        "gold_chunk_ids": ["5198979d-d042-5e89-b665-69b7b0214848", "f603498c-ed35-59f0-8eb1-c6d74d9d0120"],
    },
]

# Chapter: "झाँसी की रानी" (Subhadra Kumari Chauhan's poem about Rani
# Lakshmibai, Hindi, Class 9) — 36 chunks. Second Hindi chapter for
# topical diversity (poem vs. the prose story above). Note: much of this
# chapter's raw OCR text has garbled/corrupted matras (a real property of
# the ingested corpus) — questions here are built only from passages
# whose facts remained unambiguously readable.

GOLD_QUESTIONS += [
    {
        "id": "hindi_jhansi_01",
        "chapter": "झाँसी की रानी",
        "question": "'झाँसी की रानी' कविता की रचनाकार कौन हैं, और उनका जन्म किस वर्ष हुआ था?",
        "gold_chunk_ids": ["608ef22e-fdf0-5245-b4a1-11766efe0408"],
    },
    {
        "id": "hindi_jhansi_02",
        "chapter": "झाँसी की रानी",
        "question": "सुभद्रा कुमारी चौहान की मृत्यु किस वर्ष हुई?",
        "gold_chunk_ids": ["88af78ec-2ddc-5283-ac9d-3d800e075982"],
    },
    {
        "id": "hindi_jhansi_03",
        "chapter": "झाँसी की रानी",
        "question": "सुभद्रा कुमारी चौहान को किन दो रचनाओं के लिए 'सेकसरिया पुरस्कार' से सम्मानित किया गया?",
        "gold_chunk_ids": ["88af78ec-2ddc-5283-ac9d-3d800e075982"],
    },
    {
        "id": "hindi_jhansi_04",
        "chapter": "झाँसी की रानी",
        "question": "यह कविता भारत के किस ऐतिहासिक स्वतंत्रता संग्राम की पृष्ठभूमि पर लिखी गई है?",
        "gold_chunk_ids": ["88af78ec-2ddc-5283-ac9d-3d800e075982"],
    },
    {
        "id": "hindi_jhansi_05",
        "chapter": "झाँसी की रानी",
        "question": "रानी लक्ष्मीबाई का बचपन का नाम क्या था?",
        "gold_chunk_ids": ["8abbd0b5-79ed-5e71-8f3a-e25ce44a090a"],
    },
    {
        "id": "hindi_jhansi_06",
        "chapter": "झाँसी की रानी",
        "question": "बचपन में लक्ष्मीबाई ने नाना के साथ कौन-कौन सी अस्त्र-कलाएँ (हथियार चलाना) सीखीं?",
        "gold_chunk_ids": ["8abbd0b5-79ed-5e71-8f3a-e25ce44a090a"],
    },
    {
        "id": "hindi_jhansi_07",
        "chapter": "झाँसी की रानी",
        "question": "रानी लक्ष्मीबाई के पति, झाँसी के राजा, का नाम क्या था?",
        "gold_chunk_ids": ["7c5f25a1-93fa-57e7-ae82-dfb598c46a2d"],
    },
    {
        "id": "hindi_jhansi_08",
        "chapter": "झाँसी की रानी",
        "question": "1858 में जनरल ह्यू रोज़ की अंग्रेज़ी सेना ने झाँसी के किले पर हमला किया, तब झलकारी बाई ने रानी की मदद के लिए क्या किया?",
        "gold_chunk_ids": ["143d7b92-705e-5f37-9a9e-49055bf85d3c"],
    },
    {
        "id": "hindi_jhansi_09",
        "chapter": "झाँसी की रानी",
        "question": "झलकारी बाई के पति का नाम क्या था, और वे राजा गंगाधर राव की सेना में क्या काम करते थे?",
        "gold_chunk_ids": ["7c5f25a1-93fa-57e7-ae82-dfb598c46a2d"],
    },
    {
        "id": "hindi_jhansi_10",
        "chapter": "झाँसी की रानी",
        "question": "झलकारी बाई का जन्म कब और किस गाँव में हुआ था?",
        "gold_chunk_ids": ["ea2b21d6-9800-51ca-ac70-ea8f36de3966"],
    },
    {
        "id": "hindi_jhansi_11",
        "chapter": "झाँसी की रानी",
        "question": "अंग्रेज सैनिकों के साथ लड़ाई में पूरन कोरी की मृत्यु होने पर झलकारी बाई ने क्या प्रतिक्रिया दी?",
        "gold_chunk_ids": ["143d7b92-705e-5f37-9a9e-49055bf85d3c"],
    },
    {
        "id": "hindi_jhansi_12",
        "chapter": "झाँसी की रानी",
        "question": "युद्धभूमि में अंत तक रानी लक्ष्मीबाई के साथ रहने वाली उनकी दो सखियों के नाम क्या थे?",
        "gold_chunk_ids": ["ea2b21d6-9800-51ca-ac70-ea8f36de3966"],
    },
    {
        "id": "hindi_jhansi_13",
        "chapter": "झाँसी की रानी",
        "question": "कविता के अनुसार, वीरगति प्राप्त होने के समय रानी लक्ष्मीबाई की उम्र कितनी थी?",
        "gold_chunk_ids": ["da73e72f-a8b6-5103-8a7d-6ac94715b077"],
    },
    {
        "id": "hindi_jhansi_14",
        "chapter": "झाँसी की रानी",
        "question": "कालपी में हार के बाद रानी लक्ष्मीबाई ने आगे बढ़कर किस शहर पर अधिकार किया?",
        "gold_chunk_ids": ["0edca351-e25f-5e30-ad82-44773a1b46e8"],
    },
    {
        "id": "hindi_jhansi_15",
        "chapter": "झाँसी की रानी",
        "question": "सच या झूठ: कविता के अनुसार, रानी लक्ष्मीबाई अकेली बड़ी हुईं और नाना धुंधूपंत के साथ उनका बचपन में कोई संबंध नहीं था।",
        "gold_chunk_ids": ["8abbd0b5-79ed-5e71-8f3a-e25ce44a090a"],
    },
]
