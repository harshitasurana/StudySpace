# -*- coding: utf-8 -*-
# Gold question set for the NCERT-RAG-Eval-style benchmark, built against
# the REAL local RAGProductionApp corpus (Qdrant "docs" collection,
# subject == "Mathematics", Grade 9 Ganita Manjari Part I, 200 chunks
# across 8 chapters). Each question is hand-written from actually
# reading the source chunk text (not synthetic/templated), with gold
# chunk id(s) recorded exactly as they exist in Qdrant today. Unlike the
# Science set (mostly conceptual/definitional), this set deliberately
# mixes in real numerical / word-problem questions grounded in the
# worked examples, formulas and numeric data that actually appear in
# the source chunks.

GOLD_QUESTIONS = []

# Chapter: "Orienting Yourself: The Use of Coordinates" (Mathematics, Class 9)

GOLD_QUESTIONS += [
    {
        "id": "coords_01",
        "chapter": "Orienting Yourself: The Use of Coordinates",
        "question": "What is a system of coordinates, as described at the start of the chapter?",
        "gold_chunk_ids": ["01307ddc-5a27-5ecf-9465-d30b4fab1e59"],
    },
    {
        "id": "coords_02",
        "chapter": "Orienting Yourself: The Use of Coordinates",
        "question": "What are the x-axis and y-axis, and what is the point of intersection of the two axes called?",
        "gold_chunk_ids": ["0c814e9d-3e5b-5717-843f-4c2a9f919587"],
    },
    {
        "id": "coords_03",
        "chapter": "Orienting Yourself: The Use of Coordinates",
        "question": "What are the sign conventions for the x- and y-coordinates of points in each of the four quadrants of the Cartesian plane?",
        "gold_chunk_ids": ["247349b5-4569-5b5b-b228-9db6313799d8"],
    },
    {
        "id": "coords_04",
        "chapter": "Orienting Yourself: The Use of Coordinates",
        "question": "In Fig. 1.2, point B lies on the x-axis, 4.5 units to the right of the origin O. What are its coordinates?",
        "gold_chunk_ids": ["ce526ddd-3d96-5837-be38-41252eef7e2a"],
    },
    {
        "id": "coords_05",
        "chapter": "Orienting Yourself: The Use of Coordinates",
        "question": "In Fig. 1.2, point G lies on the y-axis, 4.5 units below the origin O, and point H lies on the y-axis 4 units above O. What are the coordinates of G and H?",
        "gold_chunk_ids": ["ce526ddd-3d96-5837-be38-41252eef7e2a"],
    },
    {
        "id": "coords_06",
        "chapter": "Orienting Yourself: The Use of Coordinates",
        "question": "In Fig. 1.6, triangle ADM has vertices A(3,4), D(7,1) and M(9,6). Given that the distance moved along the x-axis (CD) is 4 units and along the y-axis (AC) is 3 units, what is the length of side AD, using the Baudhayana-Pythagoras theorem?",
        "gold_chunk_ids": ["9378194b-9788-555b-b3c3-22f26766bd99"],
    },
    {
        "id": "coords_07",
        "chapter": "Orienting Yourself: The Use of Coordinates",
        "question": "What is the general formula for the distance between two points (x1, y1) and (x2, y2) in the coordinate plane?",
        "gold_chunk_ids": ["335affc0-d087-5c8c-ac95-60b76a1a7b97", "f5f3fee4-3157-5bfe-8083-36a0290bb6b7"],
    },
    {
        "id": "coords_08",
        "chapter": "Orienting Yourself: The Use of Coordinates",
        "question": "For triangle ADM with A(3,4), D(7,1) and M(9,6), what are the lengths of sides DM and MA, expressed using square roots?",
        "gold_chunk_ids": ["335affc0-d087-5c8c-ac95-60b76a1a7b97"],
    },
    {
        "id": "coords_09",
        "chapter": "Orienting Yourself: The Use of Coordinates",
        "question": "When triangle AMD (with A(3,4), M(9,6), D(7,1)) is reflected in the y-axis as shown in Fig. 1.9, what are the coordinates of the reflected points A', M' and D'?",
        "gold_chunk_ids": ["59fb5634-b7d3-5df6-b4ca-f559d8de0b23"],
    },
    {
        "id": "coords_10",
        "chapter": "Orienting Yourself: The Use of Coordinates",
        "question": "After reflecting triangle AMD in the y-axis to get A'(-3,4) and D'(-7,1), the chapter computes C'D' as the difference of their x-coordinates: -3 - (-7). What is this distance C'D'?",
        "gold_chunk_ids": ["59fb5634-b7d3-5df6-b4ca-f559d8de0b23"],
    },
    {
        "id": "coords_11",
        "chapter": "Orienting Yourself: The Use of Coordinates",
        "question": "In Fig. 1.4, point S has coordinates (3, -5) and point Q has coordinates (-5, 3). In which quadrants do S and Q lie respectively?",
        "gold_chunk_ids": ["943f10e0-0703-53c8-8edb-da116d9f6521"],
    },
    {
        "id": "coords_12",
        "chapter": "Orienting Yourself: The Use of Coordinates",
        "question": "According to the chapter's historical introduction, whose work on zero and negative numbers made the four-quadrant Cartesian plane possible?",
        "gold_chunk_ids": ["01307ddc-5a27-5ecf-9465-d30b4fab1e59"],
    },
    {
        "id": "coords_13",
        "chapter": "Orienting Yourself: The Use of Coordinates",
        "question": "Who formalised the fact that any point in a two-dimensional plane could be defined using just two numbers representing distances from two perpendicular axes, and in what year?",
        "gold_chunk_ids": ["05bfeba5-6f70-51f5-9b72-3882254ac26d"],
    },
]

# Chapter: "Introduction to Linear Polynomials" (Mathematics, Class 9)

GOLD_QUESTIONS += [
    {
        "id": "polynom_01",
        "chapter": "Introduction to Linear Polynomials",
        "question": "What is a linear polynomial, and what is the degree of a polynomial like 3z + 7?",
        "gold_chunk_ids": ["28dc1a8b-c1d0-5776-8d2d-6dc790594718"],
    },
    {
        "id": "polynom_02",
        "chapter": "Introduction to Linear Polynomials",
        "question": "What are polynomials of degree 2, degree 3 and degree 0 called, according to the examples in the chapter?",
        "gold_chunk_ids": ["28dc1a8b-c1d0-5776-8d2d-6dc790594718"],
    },
    {
        "id": "polynom_03",
        "chapter": "Introduction to Linear Polynomials",
        "question": "In Example 6, the sum of two numbers is 64, and one number is 10 more than the other. What linear equation is formed by letting the smaller number be x, and what are the two numbers?",
        "gold_chunk_ids": ["0233ecab-938a-5332-b4d1-12b35f44700c"],
    },
    {
        "id": "polynom_04",
        "chapter": "Introduction to Linear Polynomials",
        "question": "For the linear polynomial (function) 2x + 3, what is the output value when x = 4, and when x = -6?",
        "gold_chunk_ids": ["0233ecab-938a-5332-b4d1-12b35f44700c"],
    },
    {
        "id": "polynom_05",
        "chapter": "Introduction to Linear Polynomials",
        "question": "What characteristic feature do linear polynomials have regarding the difference between their successive values at consecutive integers?",
        "gold_chunk_ids": ["c9e629e5-0cc7-525e-b9b6-699c4a58288a"],
    },
    {
        "id": "polynom_06",
        "chapter": "Introduction to Linear Polynomials",
        "question": "The perimeter of a square of side x is 4x. Using this linear polynomial, what is the perimeter of a square with side 2.5 cm?",
        "gold_chunk_ids": ["9a244bf1-1abe-52f5-a201-dca342238a32"],
    },
    {
        "id": "polynom_07",
        "chapter": "Introduction to Linear Polynomials",
        "question": "A chess club charges a joining fee of Rs 200 plus Rs 50 for every match played. According to the table in the chapter, what is the total amount paid after 3 matches, and what is the linear polynomial expression 200 + 50m for m matches?",
        "gold_chunk_ids": ["9a244bf1-1abe-52f5-a201-dca342238a32"],
    },
    {
        "id": "polynom_08",
        "chapter": "Introduction to Linear Polynomials",
        "question": "A wire of length 20 cm is bent to form a rectangle of length x cm. What is the algebraic expression for the area of such a rectangle?",
        "gold_chunk_ids": ["93ea5348-c315-5122-84ab-43ee95abb2e8"],
    },
    {
        "id": "polynom_09",
        "chapter": "Introduction to Linear Polynomials",
        "question": "A rectangular garden of length l metres and width w metres is fenced with wire along the length (Rs 100/m), wooden fencing along the width (Rs 80/m), and seeds sown throughout costing Rs 50 per square metre. What is the total cost expression?",
        "gold_chunk_ids": ["93ea5348-c315-5122-84ab-43ee95abb2e8"],
    },
    {
        "id": "polynom_10",
        "chapter": "Introduction to Linear Polynomials",
        "question": "An auto-rickshaw fare starts at Rs 25 and stays the same for the initial 2 km, then increases by Rs 15 per km. What is the total fare for a 10 km journey?",
        "gold_chunk_ids": ["6321a710-3191-5c12-90bf-c91281ffcc47"],
    },
    {
        "id": "polynom_11",
        "chapter": "Introduction to Linear Polynomials",
        "question": "Bela has Rs 100 pocket money and spends Rs 5 every day. According to the table in Example 7, how much money is left after 4 days, and what is the amount left formula for the nth day?",
        "gold_chunk_ids": ["fabe0a98-968c-5074-9ca5-1a18340ea707"],
    },
    {
        "id": "polynom_12",
        "chapter": "Introduction to Linear Polynomials",
        "question": "The cost of a journey is given by the linear function C(d) = 100 + 60d, where C is the cost in rupees and d is the distance in km. According to the table in Example 9, what is the cost of travelling 3 km?",
        "gold_chunk_ids": ["28fd2fb8-3b2e-57e8-9ce0-f6b16cc1b3a3"],
    },
    {
        "id": "polynom_13",
        "chapter": "Introduction to Linear Polynomials",
        "question": "A student's monthly phone bill y depends on internet data used x (in GB) according to y = ax + b. When she used 10 GB, her bill was Rs 350; when she used 20 GB, her bill was Rs 550. What are the values of a and b, and what is the resulting linear relationship?",
        "gold_chunk_ids": ["4e2d7192-aac7-51ef-89d8-3451d43f5a34", "90f31d68-c164-5d20-9c01-1d98b63599eb"],
    },
    {
        "id": "polynom_14",
        "chapter": "Introduction to Linear Polynomials",
        "question": "In the equation y = ax + b, what do 'a' and 'b' represent, and what happens to a set of lines if a is kept fixed while b varies?",
        "gold_chunk_ids": ["25ffdcea-5e4d-52e4-a5eb-cf6d909f392f"],
    },
    {
        "id": "polynom_15",
        "chapter": "Introduction to Linear Polynomials",
        "question": "In Fig. 2.14, where do the lines y = 2x + 5, y = x + 3, and y = 3x - 2 cut the y-axis, and what is the y-intercept of each?",
        "gold_chunk_ids": ["9a244bf1-1abe-52f5-a201-dca342238a32"],
    },
    {
        "id": "polynom_16",
        "chapter": "Introduction to Linear Polynomials",
        "question": "How is linear growth different from linear decay, in terms of the slope of the line representing the pattern?",
        "gold_chunk_ids": ["e78fb7f3-f014-5011-ba6b-2b1fa785773b", "264d3cc8-0d98-57ce-857e-ebb901b2b6ea"],
    },
    {
        "id": "polynom_17",
        "chapter": "Introduction to Linear Polynomials",
        "question": "In Example 12, the points (-1,-3), (0,0), (1,3), (3,9) and (4,12) are plotted and found to lie on a straight line. What is the equation of this line?",
        "gold_chunk_ids": ["22178367-9418-562b-bb5c-500caf08df20"],
    },
    {
        "id": "polynom_18",
        "chapter": "Introduction to Linear Polynomials",
        "question": "A mobile phone is bought for Rs 10,000 and its value decreases by Rs 800 every year. What is the value of the phone after 3 years, and why does this represent linear decay?",
        "gold_chunk_ids": ["08fa8496-0165-56d3-b867-afabbf48a2fe"],
    },
]

# Chapter: "The World of Numbers" (Mathematics, Class 9)

GOLD_QUESTIONS += [
    {
        "id": "numbers_01",
        "chapter": "The World of Numbers",
        "question": "According to Brahmagupta's rules for the arithmetic of integers, what is a fortune plus a fortune, and what is a debt plus a debt?",
        "gold_chunk_ids": ["7a825aa4-fb94-589d-a748-e888a8b078c5"],
    },
    {
        "id": "numbers_02",
        "chapter": "The World of Numbers",
        "question": "According to Brahmagupta's laws, what is (-3) x (-4), and how is this explained using the debt analogy of removing four debts of Rs 3 each?",
        "gold_chunk_ids": ["1c0799eb-0dd3-5b9a-b96d-e4f56992538d"],
    },
    {
        "id": "numbers_03",
        "chapter": "The World of Numbers",
        "question": "How does Brahmagupta define zero in his work the Brahmasphutasiddhanta (628 CE)?",
        "gold_chunk_ids": ["2914ef2a-8acf-5005-850f-5cff35b7126e"],
    },
    {
        "id": "numbers_04",
        "chapter": "The World of Numbers",
        "question": "Convert the pure repeating decimal 0.6 (0.666...) into the form p/q, following the steps shown in Example 5.",
        "gold_chunk_ids": ["2e197d66-0745-502e-b821-c3d58ad43ffe"],
    },
    {
        "id": "numbers_05",
        "chapter": "The World of Numbers",
        "question": "Convert the pure repeating decimal 0.45 (0.454545...) into the form p/q, following the steps shown in Example 6.",
        "gold_chunk_ids": ["2e197d66-0745-502e-b821-c3d58ad43ffe"],
    },
    {
        "id": "numbers_06",
        "chapter": "The World of Numbers",
        "question": "Convert the general repeating decimal 2.357 (where '35' is non-repeating and '7' repeats) into the form p/q, following the steps shown in Example 8.",
        "gold_chunk_ids": ["04b7ee41-071e-554b-af98-4a5402a7fc95"],
    },
    {
        "id": "numbers_07",
        "chapter": "The World of Numbers",
        "question": "Convert the general repeating decimal 2.4537 (where '45' is non-repeating and '37' repeats) into the form p/q, following the steps shown in Example 9.",
        "gold_chunk_ids": ["04b7ee41-071e-554b-af98-4a5402a7fc95"],
    },
    {
        "id": "numbers_08",
        "chapter": "The World of Numbers",
        "question": "Using prime factorisation of the denominator, show how 3/20 equals the terminating decimal 0.15.",
        "gold_chunk_ids": ["10333e3f-4bf4-54bb-bbb3-3017b8b8f98d"],
    },
    {
        "id": "numbers_09",
        "chapter": "The World of Numbers",
        "question": "For which prime factors of q will the decimal expansion of a rational number p/q (in lowest terms) be terminating?",
        "gold_chunk_ids": ["10333e3f-4bf4-54bb-bbb3-3017b8b8f98d"],
    },
    {
        "id": "numbers_10",
        "chapter": "The World of Numbers",
        "question": "Outline the proof by contradiction that shows the square root of 2 is irrational, as given step by step in the chapter.",
        "gold_chunk_ids": ["c1119f9a-34a6-5ebb-8bd1-e017346b5da0"],
    },
    {
        "id": "numbers_11",
        "chapter": "The World of Numbers",
        "question": "Who gave the first proof of the irrationality of the square root of 2, and to which school of mathematicians did he belong?",
        "gold_chunk_ids": ["31526729-9c60-5a20-8054-bba3af114bb4"],
    },
    {
        "id": "numbers_12",
        "chapter": "The World of Numbers",
        "question": "Using the Baudhayana-Pythagoras theorem, what is the length of the diagonal of a square with side exactly 1 unit, and why is this length mathematically significant?",
        "gold_chunk_ids": ["31526729-9c60-5a20-8054-bba3af114bb4"],
    },
    {
        "id": "numbers_13",
        "chapter": "The World of Numbers",
        "question": "A merchant in the port city of Lothal receives 15 copper ingots for every 2 bags of spices. If he brings 12 bags of spices to the market, how many copper ingots will he receive?",
        "gold_chunk_ids": ["4f644199-3486-58f7-bd47-295dd84c975c"],
    },
    {
        "id": "numbers_14",
        "chapter": "The World of Numbers",
        "question": "What are the five stages in the evolution of the world of numbers described in the chapter's conclusion, from Natural Numbers through to Real Numbers?",
        "gold_chunk_ids": ["35ad2d99-74f9-53b2-a186-e1c397b6e91a"],
    },
    {
        "id": "numbers_15",
        "chapter": "The World of Numbers",
        "question": "Using the average (a+b)/2, explain why there is always a rational number between any two rational numbers a and b, and what property of rational numbers this illustrates.",
        "gold_chunk_ids": ["9894dd3f-9e48-54ba-bb08-bbb19d4230fb"],
    },
    {
        "id": "numbers_16",
        "chapter": "The World of Numbers",
        "question": "What value did Aryabhata (499 CE) give as an approximation for pi, and what Sanskrit term did he use to describe it?",
        "gold_chunk_ids": ["33d7ff83-8da2-5286-bc75-f40a86eec640"],
    },
    {
        "id": "numbers_17",
        "chapter": "The World of Numbers",
        "question": "What is a cyclic number, and how does multiplying the repeating block of 1/7 (142857) by the digits 1 through 6 illustrate this property?",
        "gold_chunk_ids": ["abd12805-1829-5681-9581-4be3cfacd22d"],
    },
    {
        "id": "numbers_18",
        "chapter": "The World of Numbers",
        "question": "What surprising fact does the chapter state about the non-terminating decimal 0.999... and its relationship to the number 1?",
        "gold_chunk_ids": ["93c2f9f6-faae-5244-9889-6917cd97f658"],
    },
    {
        "id": "numbers_19",
        "chapter": "The World of Numbers",
        "question": "What is the absolute value of a rational number x, written |x|, and what are the values of |5/3| and |-5/3|?",
        "gold_chunk_ids": ["891d4d0e-69a0-5704-b978-a8f435d86692"],
    },
]

# Chapter: "Exploring Algebraic Identities" (Mathematics, Class 9)

GOLD_QUESTIONS += [
    {
        "id": "identities_01",
        "chapter": "Exploring Algebraic Identities",
        "question": "What is the difference between an algebraic equation and an algebraic identity?",
        "gold_chunk_ids": ["27cc5b37-3251-53ca-be67-f98dc192902a"],
    },
    {
        "id": "identities_02",
        "chapter": "Exploring Algebraic Identities",
        "question": "Using a = 10 and b = 2, compute (a+b)^2 and a^2+b^2. Which of the two is greater, and by how much?",
        "gold_chunk_ids": ["1e4cfc13-12f3-5c9c-8df0-32f567056113"],
    },
    {
        "id": "identities_03",
        "chapter": "Exploring Algebraic Identities",
        "question": "Using the identity (a+b)^2 = a^2 + 2ab + b^2, expand (5x + 2y)^2.",
        "gold_chunk_ids": ["1e4cfc13-12f3-5c9c-8df0-32f567056113"],
    },
    {
        "id": "identities_04",
        "chapter": "Exploring Algebraic Identities",
        "question": "Using the identity (a+b)^2 = a^2 + 2ab + b^2, calculate 43^2 by writing 43 as (40+3).",
        "gold_chunk_ids": ["1e4cfc13-12f3-5c9c-8df0-32f567056113"],
    },
    {
        "id": "identities_05",
        "chapter": "Exploring Algebraic Identities",
        "question": "Factor the algebraic expression x^2 + 4x + 4 using the identity a^2 + 2ab + b^2.",
        "gold_chunk_ids": ["6421a2bc-1e8d-5679-b771-bc46d9ea3b82"],
    },
    {
        "id": "identities_06",
        "chapter": "Exploring Algebraic Identities",
        "question": "Factor the algebraic expression 36x^2 + 12x + 1 using the identity a^2 + 2ab + b^2.",
        "gold_chunk_ids": ["6421a2bc-1e8d-5679-b771-bc46d9ea3b82"],
    },
    {
        "id": "identities_07",
        "chapter": "Exploring Algebraic Identities",
        "question": "Factor 50p^2 + 60pq + 18q^2 completely, first taking out the common factor of 2 and then using an algebraic identity.",
        "gold_chunk_ids": ["6421a2bc-1e8d-5679-b771-bc46d9ea3b82", "b2b4e2f4-54f3-5fe1-8e0a-e301bd40b076"],
    },
    {
        "id": "identities_08",
        "chapter": "Exploring Algebraic Identities",
        "question": "Using the identity (a-b)^2 = a^2 - 2ab + b^2, calculate 29^2 by writing 29 as (30-1).",
        "gold_chunk_ids": ["b2b4e2f4-54f3-5fe1-8e0a-e301bd40b076"],
    },
    {
        "id": "identities_09",
        "chapter": "Exploring Algebraic Identities",
        "question": "Using the identity (a+b+c)^2 = a^2+b^2+c^2+2ab+2bc+2ca, calculate 119^2 by writing 119 as (100+10+9).",
        "gold_chunk_ids": ["366af109-ffc5-5dec-80c4-d3733921b100"],
    },
    {
        "id": "identities_10",
        "chapter": "Exploring Algebraic Identities",
        "question": "What identity did Shridharacharya propose in 750 CE for quickly computing squares, and how is it used to compute 55^2 = 3025?",
        "gold_chunk_ids": ["6832e1f4-2d56-539e-b038-02a0e02c482d"],
    },
    {
        "id": "identities_11",
        "chapter": "Exploring Algebraic Identities",
        "question": "Factor x^2 + 7x + 12 by finding values of a and b such that a+b=7 and ab=12.",
        "gold_chunk_ids": ["aec8630f-a956-549b-9207-3ed2ac593ac4"],
    },
    {
        "id": "identities_12",
        "chapter": "Exploring Algebraic Identities",
        "question": "Factor x^2 + 11x + 30 by finding values of a and b such that a+b=11 and ab=30.",
        "gold_chunk_ids": ["aec8630f-a956-549b-9207-3ed2ac593ac4"],
    },
    {
        "id": "identities_13",
        "chapter": "Exploring Algebraic Identities",
        "question": "Factor x^2 - 5x + 6 by finding values of a and b such that a+b=-5 and ab=6.",
        "gold_chunk_ids": ["aec8630f-a956-549b-9207-3ed2ac593ac4"],
    },
    {
        "id": "identities_14",
        "chapter": "Exploring Algebraic Identities",
        "question": "Using the identity (a+b)^3 = a^3 + 3a^2b + 3ab^2 + b^3, find the side of a cube whose volume is p^3 + 6p^2q + 12pq^2 + 8q^3 cubic units.",
        "gold_chunk_ids": ["b189c891-c658-5e2d-ad02-ad9b4100fb58"],
    },
    {
        "id": "identities_15",
        "chapter": "Exploring Algebraic Identities",
        "question": "Rewrite the expression 8n^3 - 60n^2m + 150nm^2 - 125m^3 in the form (a-b)^3, and identify a and b.",
        "gold_chunk_ids": ["b189c891-c658-5e2d-ad02-ad9b4100fb58"],
    },
    {
        "id": "identities_16",
        "chapter": "Exploring Algebraic Identities",
        "question": "Three numbers x, y, z satisfy x+y+z=10, xyz=25, and x^2+y^2+z^2=38. Using the identity (x+y+z)(x^2+y^2+z^2-xy-xz-yz) = x^3+y^3+z^3-3xyz, find the sum of their cubes x^3+y^3+z^3.",
        "gold_chunk_ids": ["72238eef-5da6-55c1-be35-74bc57cb8078", "9378c1b2-d097-5976-92ac-a61a354d5f6e"],
    },
    {
        "id": "identities_17",
        "chapter": "Exploring Algebraic Identities",
        "question": "Simplify the rational expression (x^2 - 7x + 12) / (5x^2 + 5x - 100), assuming the denominator is not equal to zero.",
        "gold_chunk_ids": ["854a43bb-d581-587c-a157-43e87325efbf"],
    },
    {
        "id": "identities_18",
        "chapter": "Exploring Algebraic Identities",
        "question": "A rectangular pool's breadth is 4 metres less than its length, and its area is 96 square metres. Find the length and breadth of the pool by setting up and solving a quadratic equation.",
        "gold_chunk_ids": ["5284541d-59ed-5d9e-a3b6-fa26685dc74f"],
    },
    {
        "id": "identities_19",
        "chapter": "Exploring Algebraic Identities",
        "question": "According to the chapter summary, what are the identities for x^3 - y^3 and x^3 + y^3 in terms of x and y?",
        "gold_chunk_ids": ["2473d915-9dc9-5eda-bb59-4ec80e331441"],
    },
]

# Chapter: "I'm Up and Down, and Round and Round" (Mathematics, Class 9)

GOLD_QUESTIONS += [
    {
        "id": "circles_01",
        "chapter": "I'm Up and Down, and Round and Round",
        "question": "How is a circle defined as a locus of points, and what are the centre and radius of a circle?",
        "gold_chunk_ids": ["29d8b558-d0ff-5e95-a738-48ce2c563f84"],
    },
    {
        "id": "circles_02",
        "chapter": "I'm Up and Down, and Round and Round",
        "question": "State Theorem 1: how many circles pass through three non-collinear points?",
        "gold_chunk_ids": ["2400ce43-1405-581b-84d6-483fded9e103"],
    },
    {
        "id": "circles_03",
        "chapter": "I'm Up and Down, and Round and Round",
        "question": "For an acute-angled triangle, an obtuse-angled triangle, and a right-angled triangle, where does the circumcentre lie in each case?",
        "gold_chunk_ids": ["67c79f3c-3736-575f-8cc3-98dfe7cf3e6d"],
    },
    {
        "id": "circles_04",
        "chapter": "I'm Up and Down, and Round and Round",
        "question": "State Theorem 2: what can be said about the angles subtended at the centre of a circle by two chords of equal length?",
        "gold_chunk_ids": ["0760b3d7-a0bc-5f26-8d08-910e62504e48"],
    },
    {
        "id": "circles_05",
        "chapter": "I'm Up and Down, and Round and Round",
        "question": "State Theorem 3, the converse of Theorem 2, about chords of a circle that subtend equal angles at the centre.",
        "gold_chunk_ids": ["a0728f4d-8227-5ef3-aeec-fb2cdcdda05b"],
    },
    {
        "id": "circles_06",
        "chapter": "I'm Up and Down, and Round and Round",
        "question": "State Theorem 4: what is the relationship between the line joining the centre of a circle to the midpoint of a chord, and the chord itself?",
        "gold_chunk_ids": ["8ca47671-7f1a-577a-9771-3d66dd56ee3c"],
    },
    {
        "id": "circles_07",
        "chapter": "I'm Up and Down, and Round and Round",
        "question": "State Theorem 5, the converse of Theorem 4, about the perpendicular from the centre of a circle to a chord.",
        "gold_chunk_ids": ["49fc7737-6d04-5af5-b5d8-b9d95b3d441d"],
    },
    {
        "id": "circles_08",
        "chapter": "I'm Up and Down, and Round and Round",
        "question": "State Theorem 6: what can be said about chords of a circle that have the same length, in terms of their distance from the centre?",
        "gold_chunk_ids": ["77fb1883-d3b8-5db9-b00c-ea58cacfa99e"],
    },
    {
        "id": "circles_09",
        "chapter": "I'm Up and Down, and Round and Round",
        "question": "State Theorem 8: if chord AB is longer than chord DE in the same circle with centre C, how do their perpendicular distances from C compare?",
        "gold_chunk_ids": ["7ab963ab-5412-5683-8fbe-0fdc94879504"],
    },
    {
        "id": "circles_10",
        "chapter": "I'm Up and Down, and Round and Round",
        "question": "Using the formula 'chord length = 2 times the square root of (r squared minus d squared)', find the length of a chord in a circle of radius 7 cm whose perpendicular distance from the centre is 6 cm.",
        "gold_chunk_ids": ["7ab963ab-5412-5683-8fbe-0fdc94879504"],
    },
    {
        "id": "circles_11",
        "chapter": "I'm Up and Down, and Round and Round",
        "question": "In a circle, a chord is 5 cm away from the centre, and the radius of the circle is 13 cm. What is the length of the chord?",
        "gold_chunk_ids": ["dc8b0e58-d080-5ce2-ae79-6ee048323688", "7ab963ab-5412-5683-8fbe-0fdc94879504"],
    },
    {
        "id": "circles_12",
        "chapter": "I'm Up and Down, and Round and Round",
        "question": "The diameter of a circle is 26 cm, and a chord of length 24 cm is drawn in the circle. Find the distance from the centre of the circle to the chord.",
        "gold_chunk_ids": ["dc8b0e58-d080-5ce2-ae79-6ee048323688", "7ab963ab-5412-5683-8fbe-0fdc94879504"],
    },
    {
        "id": "circles_13",
        "chapter": "I'm Up and Down, and Round and Round",
        "question": "State Theorem 9: how does the angle subtended by an arc at the centre of a circle compare to the angle it subtends at a point on the circle outside the arc?",
        "gold_chunk_ids": ["524f56a0-fa34-5048-916e-c170c5f611a1"],
    },
    {
        "id": "circles_14",
        "chapter": "I'm Up and Down, and Round and Round",
        "question": "What is the corollary of Theorem 9 regarding the angle subtended by a diameter at any point on the circle?",
        "gold_chunk_ids": ["5cb9401f-53a6-551c-93d3-8ce86c264d41"],
    },
    {
        "id": "circles_15",
        "chapter": "I'm Up and Down, and Round and Round",
        "question": "State Theorem 11: what is the sum of two opposite angles of a cyclic quadrilateral?",
        "gold_chunk_ids": ["d00a4752-6cc8-5c43-9216-abefbe56e258", "cf1dcd51-be87-5ef9-98ff-c25deb2c6d95"],
    },
    {
        "id": "circles_16",
        "chapter": "I'm Up and Down, and Round and Round",
        "question": "In a cyclic quadrilateral ABCD inscribed in a circle, if angle A measures 75 degrees, what is the measure of angle C? If angle B measures 110 degrees, what is the measure of angle D?",
        "gold_chunk_ids": ["dc8b0e58-d080-5ce2-ae79-6ee048323688"],
    },
    {
        "id": "circles_17",
        "chapter": "I'm Up and Down, and Round and Round",
        "question": "State Theorem 10: under what condition do four points A, B, C, D lie on the same circle (are concyclic)?",
        "gold_chunk_ids": ["a6e2347d-e38c-53c4-9220-07cb0fe654b6"],
    },
    {
        "id": "circles_18",
        "chapter": "I'm Up and Down, and Round and Round",
        "question": "What are the two types of symmetry that a circle has, according to the section on symmetries of a circle?",
        "gold_chunk_ids": ["1347e8fd-d40f-5b96-99e8-817930838bde"],
    },
]

# Chapter: "Measuring Space: Perimeter and Area" (Mathematics, Class 9)

GOLD_QUESTIONS += [
    {
        "id": "mensuration_01",
        "chapter": "Measuring Space: Perimeter and Area",
        "question": "What is the formula for the perimeter of a rectangle with length a units and width b units, and why is the perimeter formula for a square a 'special case' of it?",
        "gold_chunk_ids": ["47ef2ef8-efb6-561f-8960-63bc862b50fa"],
    },
    {
        "id": "mensuration_02",
        "chapter": "Measuring Space: Perimeter and Area",
        "question": "What is the ratio of perimeter to side for all squares, and what is this ratio for all equilateral triangles?",
        "gold_chunk_ids": ["47ef2ef8-efb6-561f-8960-63bc862b50fa", "09b65d43-4625-54b7-b7f3-33e48a01d567"],
    },
    {
        "id": "mensuration_03",
        "chapter": "Measuring Space: Perimeter and Area",
        "question": "The perimeter (circumference) of a circle is 44 cm. Using the approximation pi = 22/7, what is its radius?",
        "gold_chunk_ids": ["e2d5ce6d-6d93-52bb-b337-ef14f6134e87"],
    },
    {
        "id": "mensuration_04",
        "chapter": "Measuring Space: Perimeter and Area",
        "question": "What approximate value did Mesopotamian mathematicians (c. 1900 BCE) set for pi, and how did comparing a circle's perimeter to an inscribed hexagon show that pi must be greater than 3?",
        "gold_chunk_ids": ["37bb9986-259d-5db0-a599-019a612d7609"],
    },
    {
        "id": "mensuration_05",
        "chapter": "Measuring Space: Perimeter and Area",
        "question": "What bounds for pi did Archimedes establish by working with inscribed and circumscribed 96-sided polygons?",
        "gold_chunk_ids": ["37bb9986-259d-5db0-a599-019a612d7609"],
    },
    {
        "id": "mensuration_06",
        "chapter": "Measuring Space: Perimeter and Area",
        "question": "What value for pi did Aryabhata give in 499 CE, and what term ('asanna') did he use to describe it?",
        "gold_chunk_ids": ["8305a071-87ea-56a1-8d4a-b9f82cf74bd7"],
    },
    {
        "id": "mensuration_07",
        "chapter": "Measuring Space: Perimeter and Area",
        "question": "What are Zu Chongzhi's Yuelu (Approximate Ratio) and Miu (Close Ratio) values for pi, and why was the Miu value historically significant?",
        "gold_chunk_ids": ["8305a071-87ea-56a1-8d4a-b9f82cf74bd7"],
    },
    {
        "id": "mensuration_08",
        "chapter": "Measuring Space: Perimeter and Area",
        "question": "What is Madhava's infinite series formula for pi, discovered in the 14th century?",
        "gold_chunk_ids": ["8305a071-87ea-56a1-8d4a-b9f82cf74bd7"],
    },
    {
        "id": "mensuration_09",
        "chapter": "Measuring Space: Perimeter and Area",
        "question": "What is the formula for the length of an arc of a circle that subtends an angle theta degrees at the centre, in terms of the radius r?",
        "gold_chunk_ids": ["8693777f-8d81-5c4c-868a-3c1fa329c64c"],
    },
    {
        "id": "mensuration_10",
        "chapter": "Measuring Space: Perimeter and Area",
        "question": "Two congruent circles of radius r each pass through the other's centre, intersecting at points C and D. Given that triangle ABC is equilateral and each dotted arc is 1/3 of the circumference, what is the total length of the two red arcs shown in Fig. 6.12, in terms of r?",
        "gold_chunk_ids": ["3be9df7b-22b2-5c03-ae7e-677f3203bf39"],
    },
    {
        "id": "mensuration_11",
        "chapter": "Measuring Space: Perimeter and Area",
        "question": "What is the formula for the area of a rectangle with sides a units and b units, and what is the area of a square with side a units as a special case?",
        "gold_chunk_ids": ["3b1d09d5-1369-52bc-a397-f1eeca043e61"],
    },
    {
        "id": "mensuration_12",
        "chapter": "Measuring Space: Perimeter and Area",
        "question": "How is a parallelogram transformed into a rectangle in Fig. 6.17 to show that the area of a parallelogram equals base times height?",
        "gold_chunk_ids": ["100442d2-416f-541e-b2c7-724ff789bdac"],
    },
    {
        "id": "mensuration_13",
        "chapter": "Measuring Space: Perimeter and Area",
        "question": "State the theorem about a median of a triangle: what can be said about the areas of the two triangles it creates?",
        "gold_chunk_ids": ["122c92ee-ed53-5213-b1b2-1f309d1287ee"],
    },
    {
        "id": "mensuration_14",
        "chapter": "Measuring Space: Perimeter and Area",
        "question": "State Heron's formula for the area of a triangle with side lengths a, b, c and semi-perimeter s.",
        "gold_chunk_ids": ["1fd8366b-9324-50dc-af35-26ad04479277"],
    },
    {
        "id": "mensuration_15",
        "chapter": "Measuring Space: Perimeter and Area",
        "question": "Using Heron's formula, find the area of a triangle with sides 3, 4 and 5 units, and verify this against the 'half base times height' formula.",
        "gold_chunk_ids": ["5842714d-ac78-5e5f-9fa3-30213d9a76f6"],
    },
    {
        "id": "mensuration_16",
        "chapter": "Measuring Space: Perimeter and Area",
        "question": "For an equilateral triangle with side a units, use Heron's formula (with semi-perimeter s = 3a/2) to show that its area is (square root of 3 divided by 4) times a squared.",
        "gold_chunk_ids": ["1fd8366b-9324-50dc-af35-26ad04479277", "ad4e11e5-2f7b-57be-855c-e112e5f1a620"],
    },
    {
        "id": "mensuration_17",
        "chapter": "Measuring Space: Perimeter and Area",
        "question": "What are the two formulas for the area of a triangle with sides a, b, c in terms of its circumradius R and its inradius r?",
        "gold_chunk_ids": ["5842714d-ac78-5e5f-9fa3-30213d9a76f6"],
    },
    {
        "id": "mensuration_18",
        "chapter": "Measuring Space: Perimeter and Area",
        "question": "An isosceles triangle has a perimeter of 40 cm, with equal sides of 15 cm each. Using Heron's formula, what is the semi-perimeter, and what expression must be evaluated to find its area?",
        "gold_chunk_ids": ["b53d8e4b-ab7c-5b8e-ba6f-ab83a1a96d5d", "1fd8366b-9324-50dc-af35-26ad04479277"],
    },
    {
        "id": "mensuration_19",
        "chapter": "Measuring Space: Perimeter and Area",
        "question": "If the wheel of a bicycle has a diameter of 60 cm, how far will a cyclist travel after the wheel has rotated 100 times? (Use pi = 22/7.)",
        "gold_chunk_ids": ["b53d8e4b-ab7c-5b8e-ba6f-ab83a1a96d5d"],
    },
    {
        "id": "mensuration_20",
        "chapter": "Measuring Space: Perimeter and Area",
        "question": "What is the formula for the area of a sector of a circle that subtends an angle theta degrees at the centre, in terms of the radius r?",
        "gold_chunk_ids": ["807739f6-f7d5-59e1-8192-839169114f9c"],
    },
    {
        "id": "mensuration_21",
        "chapter": "Measuring Space: Perimeter and Area",
        "question": "Find the area of a sector of a circle with radius 7 cm if the angle of the sector is 60 degrees. (Use pi = 22/7.)",
        "gold_chunk_ids": ["d66577dd-c3b6-58bd-b5e5-5a76925c215b", "807739f6-f7d5-59e1-8192-839169114f9c"],
    },
    {
        "id": "mensuration_22",
        "chapter": "Measuring Space: Perimeter and Area",
        "question": "State Brahmagupta's formula for the area of a cyclic quadrilateral with sides a, b, c, d, and explain how it generalises Heron's formula for triangles when one side has zero length.",
        "gold_chunk_ids": ["47671eaa-402f-5d76-85a8-66aba737135f", "fd2c7096-bbfa-54f4-9a9e-907e8ff40946"],
    },
]

# Chapter: "The Mathematics of Maybe: Introduction to Probability" (Mathematics, Class 9)

GOLD_QUESTIONS += [
    {
        "id": "probability_01",
        "chapter": "The Mathematics of Maybe: Introduction to Probability",
        "question": "What is a random experiment, according to the chapter's definition of randomness?",
        "gold_chunk_ids": ["0f386960-46c1-5220-b956-39cd3b1cd291"],
    },
    {
        "id": "probability_02",
        "chapter": "The Mathematics of Maybe: Introduction to Probability",
        "question": "On what scale is probability measured, and what do the values 0 and 1 represent?",
        "gold_chunk_ids": ["46a58ca7-3e21-54c5-b859-e4593d2e06b0"],
    },
    {
        "id": "probability_03",
        "chapter": "The Mathematics of Maybe: Introduction to Probability",
        "question": "What is the formula for the theoretical probability of an event?",
        "gold_chunk_ids": ["323f1bca-b9c3-50a5-b98d-4d9c39bb48da"],
    },
    {
        "id": "probability_04",
        "chapter": "The Mathematics of Maybe: Introduction to Probability",
        "question": "If you roll a standard 6-sided die, what is the theoretical probability of getting a 4?",
        "gold_chunk_ids": ["323f1bca-b9c3-50a5-b98d-4d9c39bb48da"],
    },
    {
        "id": "probability_05",
        "chapter": "The Mathematics of Maybe: Introduction to Probability",
        "question": "A letter is picked at random from the word 'PROBABILITY'. What is the probability of picking the letter B?",
        "gold_chunk_ids": ["f510cff6-d45a-5f9e-938c-f1d8f3dbb1a9"],
    },
    {
        "id": "probability_06",
        "chapter": "The Mathematics of Maybe: Introduction to Probability",
        "question": "What is the formula for experimental probability?",
        "gold_chunk_ids": ["c82830ec-4b15-5542-ae32-62bfdfbde4b6"],
    },
    {
        "id": "probability_07",
        "chapter": "The Mathematics of Maybe: Introduction to Probability",
        "question": "Suppose you roll a die 50 times, and it lands on a 4 exactly 8 times. What is the experimental probability of rolling a 4?",
        "gold_chunk_ids": ["c82830ec-4b15-5542-ae32-62bfdfbde4b6"],
    },
    {
        "id": "probability_08",
        "chapter": "The Mathematics of Maybe: Introduction to Probability",
        "question": "In a survey, 20 out of 50 students said mango is their favourite fruit. What is the probability that a randomly chosen student's favourite fruit is mango, and how many mangoes might you need to buy for 1500 students based on this estimate?",
        "gold_chunk_ids": ["33ef04a2-d41d-5021-8b73-a682d77b3e65"],
    },
    {
        "id": "probability_09",
        "chapter": "The Mathematics of Maybe: Introduction to Probability",
        "question": "What is the sample space of a random experiment, and what is meant by the 'sample size' n(S)?",
        "gold_chunk_ids": ["7d594f2b-45be-56ff-a10b-6c789374d85d"],
    },
    {
        "id": "probability_10",
        "chapter": "The Mathematics of Maybe: Introduction to Probability",
        "question": "What is the sample space for the experiment of tossing two coins simultaneously?",
        "gold_chunk_ids": ["c026c6a0-e4bb-5e8f-8470-274ec12e069b"],
    },
    {
        "id": "probability_11",
        "chapter": "The Mathematics of Maybe: Introduction to Probability",
        "question": "Using a tree diagram for tossing a fair coin two times, what is the theoretical probability of getting Heads twice (the outcome HH)?",
        "gold_chunk_ids": ["20229718-9bbf-5c25-9c71-09d98ecd4257"],
    },
    {
        "id": "probability_12",
        "chapter": "The Mathematics of Maybe: Introduction to Probability",
        "question": "What is the Gambler's Fallacy, and why is the probability of getting tails on the next coin flip still 50% even after getting six heads in a row?",
        "gold_chunk_ids": ["c026c6a0-e4bb-5e8f-8470-274ec12e069b"],
    },
    {
        "id": "probability_13",
        "chapter": "The Mathematics of Maybe: Introduction to Probability",
        "question": "What does it mean for a coin to be described as 'fair' or 'unbiased'?",
        "gold_chunk_ids": ["c026c6a0-e4bb-5e8f-8470-274ec12e069b"],
    },
    {
        "id": "probability_14",
        "chapter": "The Mathematics of Maybe: Introduction to Probability",
        "question": "What is the Law of Large Numbers, as described in the chapter's discussion of experimental versus theoretical probability?",
        "gold_chunk_ids": ["33ef04a2-d41d-5021-8b73-a682d77b3e65"],
    },
    {
        "id": "probability_15",
        "chapter": "The Mathematics of Maybe: Introduction to Probability",
        "question": "A teacher randomly selects a sample of 30 sweets from a large bag and counts 10 red, 8 green, 7 yellow and 5 blue sweets. What is the probability that a randomly picked sweet from the sample is green?",
        "gold_chunk_ids": ["155d22e3-a9cc-5825-9ccb-a1227de702c4"],
    },
]

# Chapter: "Predicting What Comes Next: Exploring Sequences and Progressions" (Mathematics, Class 9)

GOLD_QUESTIONS += [
    {
        "id": "sequences_01",
        "chapter": "Predicting What Comes Next: Exploring Sequences and Progressions",
        "question": "What is the difference between an explicit formula and a recursive formula for a sequence?",
        "gold_chunk_ids": ["4a7af2ff-19f2-591c-b148-e9fa466cfc02"],
    },
    {
        "id": "sequences_02",
        "chapter": "Predicting What Comes Next: Exploring Sequences and Progressions",
        "question": "What is the general form of an arithmetic progression (AP), and what is its nth term formula in terms of the first term a and common difference d?",
        "gold_chunk_ids": ["4a7af2ff-19f2-591c-b148-e9fa466cfc02"],
    },
    {
        "id": "sequences_03",
        "chapter": "Predicting What Comes Next: Exploring Sequences and Progressions",
        "question": "What is the general form of a geometric progression (GP), and what is its nth term formula in terms of the first term a and common ratio r?",
        "gold_chunk_ids": ["4a7af2ff-19f2-591c-b148-e9fa466cfc02"],
    },
    {
        "id": "sequences_04",
        "chapter": "Predicting What Comes Next: Exploring Sequences and Progressions",
        "question": "Using the explicit rule un = 2n - 1 for the sequence of odd numbers, which term (position) of the sequence is 137?",
        "gold_chunk_ids": ["aae30f4c-4df0-55da-a89d-a9d6b7a6a9bc"],
    },
    {
        "id": "sequences_05",
        "chapter": "Predicting What Comes Next: Exploring Sequences and Progressions",
        "question": "For the sequence given by the explicit formula sn = 5n - 2, is 308 a term of the sequence? If so, which term is it?",
        "gold_chunk_ids": ["aae30f4c-4df0-55da-a89d-a9d6b7a6a9bc"],
    },
    {
        "id": "sequences_06",
        "chapter": "Predicting What Comes Next: Exploring Sequences and Progressions",
        "question": "Find the first four terms of the sequence given by the recursive rule u1 = 1, un = 2 u(n-1) + 3 for n >= 2, as computed in Example 3.",
        "gold_chunk_ids": ["59e7fb4e-03b8-550d-867d-475eb8dd3324"],
    },
    {
        "id": "sequences_07",
        "chapter": "Predicting What Comes Next: Exploring Sequences and Progressions",
        "question": "Find the first four terms of the sequence given by the recursive rule s1 = 3, sn = s(n-1) times (s(n-1) - 1) for n >= 2, as computed in Example 4.",
        "gold_chunk_ids": ["59e7fb4e-03b8-550d-867d-475eb8dd3324", "ea9b6a36-fe25-5cb8-9fb9-2ee4e0b57f1f"],
    },
    {
        "id": "sequences_08",
        "chapter": "Predicting What Comes Next: Exploring Sequences and Progressions",
        "question": "What is the Virahanka-Fibonacci sequence, and who first studied it explicitly, and in what context?",
        "gold_chunk_ids": ["ea9b6a36-fe25-5cb8-9fb9-2ee4e0b57f1f"],
    },
    {
        "id": "sequences_09",
        "chapter": "Predicting What Comes Next: Exploring Sequences and Progressions",
        "question": "For the Virahanka-Fibonacci sequence with V1 = 1, V2 = 2, and Vn = V(n-1) + V(n-2) for n >= 3, what are the first six terms?",
        "gold_chunk_ids": ["ea9b6a36-fe25-5cb8-9fb9-2ee4e0b57f1f"],
    },
    {
        "id": "sequences_10",
        "chapter": "Predicting What Comes Next: Exploring Sequences and Progressions",
        "question": "What is the formula for the sum of the first n natural numbers, and how is it derived by writing the sum forwards and backwards and adding the two?",
        "gold_chunk_ids": ["4474df3c-de3b-56e6-96cd-613f135a7d7c"],
    },
    {
        "id": "sequences_11",
        "chapter": "Predicting What Comes Next: Exploring Sequences and Progressions",
        "question": "What is the nth term formula for the sequence of triangular numbers 1, 3, 6, 10, 15, ...?",
        "gold_chunk_ids": ["4a7af2ff-19f2-591c-b148-e9fa466cfc02"],
    },
    {
        "id": "sequences_12",
        "chapter": "Predicting What Comes Next: Exploring Sequences and Progressions",
        "question": "A taxi company charges a fixed booking fee of Rs 200 plus Rs 40 per kilometre travelled. What is the nth term formula for the total fare after travelling n km, and what is the fare for a 10 km trip?",
        "gold_chunk_ids": ["b246525b-271d-5000-8439-ffbe0a907224"],
    },
    {
        "id": "sequences_13",
        "chapter": "Predicting What Comes Next: Exploring Sequences and Progressions",
        "question": "In the Sierpinski triangle fractal, the number of black triangles at each stage forms the GP 1, 3, 9, 27, .... What is the explicit formula for the number of black triangles at stage n, and how many black triangles are there at Stage 5?",
        "gold_chunk_ids": ["213e1d77-4e06-5242-98fa-f2313e82521b"],
    },
    {
        "id": "sequences_14",
        "chapter": "Predicting What Comes Next: Exploring Sequences and Progressions",
        "question": "In the Sierpinski triangle, if the area of the black region at Stage 0 is 1 square unit, what is the explicit formula for the area of the black region at stage n?",
        "gold_chunk_ids": ["213e1d77-4e06-5242-98fa-f2313e82521b", "d750f941-c0b1-5752-a0d7-b395f22dbca3"],
    },
    {
        "id": "sequences_15",
        "chapter": "Predicting What Comes Next: Exploring Sequences and Progressions",
        "question": "A ball is dropped from a height of 24 feet and bounces up to 3/4 of its previous height each time. What height does the ball reach after the third bounce?",
        "gold_chunk_ids": ["6ccb1608-9fbb-5caa-8b40-e6a5974449f1"],
    },
    {
        "id": "sequences_16",
        "chapter": "Predicting What Comes Next: Exploring Sequences and Progressions",
        "question": "Check whether the sequence 5, 15/4, 45/16, 135/64, ... is a geometric progression, and find its common ratio.",
        "gold_chunk_ids": ["89f580ec-ccc2-57b3-8bd3-0eaf303a89db"],
    },
    {
        "id": "sequences_17",
        "chapter": "Predicting What Comes Next: Exploring Sequences and Progressions",
        "question": "What is a fractal, and what examples of fractals found in nature are mentioned in the chapter?",
        "gold_chunk_ids": ["d750f941-c0b1-5752-a0d7-b395f22dbca3"],
    },
    {
        "id": "sequences_18",
        "chapter": "Predicting What Comes Next: Exploring Sequences and Progressions",
        "question": "The stages of the Sierpinski square carpet have 3, 6, 12, 24, 48, ... red squares. What is the explicit formula for the number of squares at stage n?",
        "gold_chunk_ids": ["c9ee2fe6-bd08-5357-b926-cba9bdd444f3"],
    },
    {
        "id": "sequences_19",
        "chapter": "Predicting What Comes Next: Exploring Sequences and Progressions",
        "question": "According to the chapter's introduction, what four number sequences from earlier grades (natural numbers, odd numbers, triangular numbers, square numbers) are used as opening examples of sequences?",
        "gold_chunk_ids": ["e5851d61-e59b-5ddf-91c7-17c329eac297"],
    },
]
