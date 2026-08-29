// Lagoon City University: a degree in the game. Enrol in a programme (one-off school fees), attend lectures in person
// at the campus (server-timed, a few a day, while it's open), pass each course's exam, and graduate: a degree on your
// name, a convocation gift, and better pay in every job. Exam questions come from the lecture notes, so the people
// who went to class can pass. Names and content are the game's own (no real university).

export const UNIVERSITY = {
  venue: "lagoon_city_university",
  name: "Lagoon City University",
  /** One-off school fees for a programme, City Coins. */
  fees: 30_000,
};
/** A lecture lasts this long (seconds, timed by the server), gives this XP, and you can attend this many a day. */
export const LECTURE = { seconds: 40, xp: 15, perDay: 3 };
export const LECTURES_PER_COURSE = 3;
/** Exams: this many questions, this many right to pass; a resit costs a fee. */
export const EXAM = { questions: 4, pass: 3, resitFee: 500 };
/** Convocation: the gift, the XP, and the raise every job pays graduates. */
export const GRADUATE = { coins: 10_000, xp: 2_000, payBoost: 0.25 };

export interface UniQuestion {
  q: string;
  options: [string, string, string, string];
  /** Index of the right option. */
  answer: number;
}
export interface UniCourse {
  key: string;
  code: string;
  title: string;
  /** What each lecture teaches (shown while it plays; the exam asks about it). */
  notes: [string, string, string];
  questions: UniQuestion[];
}
export interface Programme {
  key: string;
  degree: string;
  faculty: string;
  blurb: string;
  icon: string;
  courses: UniCourse[];
}

const c = (key: string, code: string, title: string, notes: [string, string, string], questions: UniQuestion[]): UniCourse => ({ key, code, title, notes, questions });
const q = (text: string, options: [string, string, string, string], answer: number): UniQuestion => ({ q: text, options, answer });

export const PROGRAMMES: readonly Programme[] = [
  {
    key: "computer_science",
    degree: "BSc Computer Science",
    faculty: "Faculty of Science",
    icon: "💻",
    blurb: "Code, data and the internet. Tech Mile is hiring.",
    courses: [
      c("csc101", "CSC 101", "Introduction to Computing", [
        "A computer takes input, processes it with the CPU, keeps it in memory and storage, and gives output. RAM is fast but forgets when power goes; storage (SSD, hard disk) keeps your files.",
        "Everything inside a computer is binary: ones and zeros. One binary digit is a bit; eight bits make a byte. 1 kilobyte is about a thousand bytes.",
        "Software is the instructions; hardware is the machine. The operating system (like Android or Windows) runs the hardware and lets apps share it.",
      ], [
        q("Which part of a computer forgets everything when the power goes off?", ["RAM", "SSD", "Hard disk", "Flash drive"], 0),
        q("How many bits make one byte?", ["2", "8", "10", "16"], 1),
        q("What does the CPU do?", ["Stores files forever", "Processes instructions", "Shows the picture", "Charges the battery"], 1),
        q("Android and Windows are examples of…", ["Hardware", "Operating systems", "Spreadsheets", "Viruses"], 1),
        q("Binary uses which digits?", ["0 to 9", "1 and 2", "0 and 1", "A to F"], 2),
      ]),
      c("csc102", "CSC 102", "Programming Fundamentals", [
        "A program is a list of steps. A variable is a named box that holds a value, like price = 500.",
        "An if statement makes a choice: if the customer pays, give them the item; otherwise, don't. A loop repeats steps, like counting every item in the basket.",
        "A function is a reusable block of steps with a name, like addVAT(price). A bug is a mistake in the code; debugging is finding and fixing it.",
      ], [
        q("In code, what is a variable?", ["A named box that holds a value", "A broken computer", "A type of cable", "A website"], 0),
        q("Which one repeats steps?", ["A variable", "A loop", "A comment", "A file"], 1),
        q("What is debugging?", ["Buying a new laptop", "Finding and fixing mistakes in code", "Deleting all files", "Typing faster"], 1),
        q("An if statement is used to…", ["Make a choice", "Store pictures", "Connect to Wi-Fi", "Print a page"], 0),
        q("A named, reusable block of steps is a…", ["Loop", "Bug", "Function", "Byte"], 2),
      ]),
      c("csc201", "CSC 201", "Data and Databases", [
        "A database keeps data in tables: rows are records (one customer), columns are fields (name, phone).",
        "Each row has a primary key, a value no other row shares, like a customer number, so you can always find the right one.",
        "SQL is the language for asking databases questions, for example SELECT name FROM customers. Back up your data: a database you can't restore is a business you can lose.",
      ], [
        q("In a database table, one customer is usually one…", ["Column", "Row", "Table", "Server"], 1),
        q("What makes a primary key special?", ["It is always a name", "No other row shares it", "It is the first column", "It is encrypted"], 1),
        q("SQL is used to…", ["Draw pictures", "Ask a database questions", "Send SMS", "Charge phones"], 1),
        q("Why back up a database?", ["To make it faster", "So you can restore it if something goes wrong", "To delete old data", "It is required to use SQL"], 1),
        q("In a table, 'phone number' would be a…", ["Row", "Column (field)", "Primary key always", "Backup"], 1),
      ]),
      c("csc202", "CSC 202", "The Internet and Security", [
        "The internet is networks of computers talking with agreed rules (protocols). A website lives on a server; your browser asks for it using its address (URL).",
        "HTTPS (the padlock) encrypts what you send, so others on the network can't read it. Never type a password on a site without it.",
        "Phishing is a fake message pretending to be your bank or a friend to steal your details. Use a different strong password for each account and turn on two-step login.",
      ], [
        q("What does the padlock (HTTPS) mean?", ["The site is free", "What you send is encrypted", "The site is government-owned", "The page loads faster"], 1),
        q("A fake message pretending to be your bank to steal your details is…", ["Phishing", "Streaming", "Routing", "Coding"], 0),
        q("Where does a website live?", ["On a server", "In your SIM card", "In the router only", "On paper"], 0),
        q("Best password habit?", ["One password for everything", "A different strong password per account", "Your birthday", "Share it with a friend"], 1),
        q("The agreed rules computers use to talk are called…", ["Protocols", "Variables", "Loops", "Fonts"], 0),
      ]),
    ],
  },
  {
    key: "business_admin",
    degree: "BSc Business Administration",
    faculty: "Faculty of Management Sciences",
    icon: "📈",
    blurb: "Run a business properly: money, people and customers.",
    courses: [
      c("bus101", "BUS 101", "Principles of Management", [
        "Management is planning, organising, leading and controlling: decide what to do, arrange people and money, guide the team, then check results against the plan.",
        "A business's mission says why it exists; its goals should be SMART: specific, measurable, achievable, relevant and time-bound.",
        "Delegation means giving a task and the authority to do it to someone on your team, while you stay accountable for the result.",
      ], [
        q("Which is NOT one of the four functions of management?", ["Planning", "Organising", "Gossiping", "Controlling"], 2),
        q("In SMART goals, the M stands for…", ["Money", "Measurable", "Monthly", "Market"], 1),
        q("Delegation means…", ["Doing everything yourself", "Giving a task and authority to someone else", "Firing staff", "Closing the shop"], 1),
        q("A mission statement explains…", ["Why the business exists", "The price list", "The staff salaries", "The opening hours"], 0),
        q("'Sell 50 pairs of shoes by December' is a goal that is…", ["Vague", "Specific and time-bound", "Impossible", "A mission"], 1),
      ]),
      c("bus102", "BUS 102", "Accounting Basics", [
        "Revenue is the money coming in from sales. Profit is revenue minus all costs (stock, rent, salaries, transport).",
        "Cash flow is the timing of money in and out. A profitable shop can still fail if cash runs out before customers pay.",
        "Keep business money separate from personal money, and record every sale and expense, even small ones.",
      ], [
        q("Profit equals…", ["Revenue plus costs", "Revenue minus costs", "Only sales", "Only stock"], 1),
        q("A business that is profitable on paper can still fail because of…", ["Too many customers", "Poor cash flow", "A nice signboard", "Low prices"], 1),
        q("Money coming in from sales is called…", ["Revenue", "Debt", "Rent", "Tax"], 0),
        q("Good practice for a small business owner?", ["Mix business and personal money", "Keep them separate and record everything", "Only record big sales", "Never count stock"], 1),
        q("Which of these is a cost?", ["Sales", "Rent", "Revenue", "Profit"], 1),
      ]),
      c("bus201", "BUS 201", "Marketing", [
        "The 4 Ps of marketing: Product (what you sell), Price, Place (where customers buy it) and Promotion (how they hear about it).",
        "Your target market is the group of people most likely to buy. Selling to 'everybody' usually means reaching nobody.",
        "Word of mouth is the strongest advert in Lagos: serve well and customers bring customers. Social media and deals help them talk about you.",
      ], [
        q("Which is one of the 4 Ps of marketing?", ["Profit", "Place", "People only", "Paper"], 1),
        q("Your target market is…", ["Everybody in Nigeria", "The people most likely to buy", "Your competitors", "Your staff"], 1),
        q("'Promotion' in the 4 Ps means…", ["Moving staff up", "How customers hear about you", "The shop location", "The cost price"], 1),
        q("The strongest advert for a small Lagos business is often…", ["Word of mouth from happy customers", "A billboard abroad", "No signboard", "High prices"], 0),
        q("Price, Product, Place and … ?", ["Promotion", "Planning", "Payment", "Partners"], 0),
      ]),
      c("bus202", "BUS 202", "Entrepreneurship", [
        "Start small and test: sell to a few real customers before spending big. A minimum viable product is the simplest thing that solves the problem.",
        "A business plan covers the problem, the customers, the competitors, the costs, the prices and how you'll grow.",
        "Registering your business (with the corporate registry) lets you open a business bank account and earn customers' trust.",
      ], [
        q("What is a minimum viable product?", ["The most expensive version", "The simplest thing that solves the problem", "A finished factory", "A loan"], 1),
        q("Why register your business?", ["To pay less for stock", "Business bank account and customers' trust", "To avoid customers", "It's only for big companies"], 1),
        q("Before spending big, a new business should…", ["Test with a few real customers", "Rent the biggest shop", "Buy a car", "Hire 20 staff"], 0),
        q("A business plan does NOT need…", ["The customers", "The costs", "Your favourite film", "The competitors"], 2),
        q("Who are 'competitors'?", ["Your suppliers", "Other businesses selling to the same customers", "Your staff", "The bank"], 1),
      ]),
    ],
  },
  {
    key: "mass_comm",
    degree: "BSc Mass Communication",
    faculty: "Faculty of Social Sciences",
    icon: "🎙️",
    blurb: "News, radio, content and PR. City FM wants voices.",
    courses: [
      c("mac101", "MAC 101", "Introduction to Mass Media", [
        "Mass media reach many people at once: newspapers, radio, TV and the internet. In Nigeria, radio still reaches the most people, from markets to motor parks.",
        "Media inform, educate, entertain and set the agenda: what the media talk about becomes what people talk about.",
        "New media (social platforms, podcasts, blogs) let anyone publish, so checking sources matters more than ever.",
      ], [
        q("Which medium still reaches the most Nigerians?", ["Radio", "Fax", "Telegram (the old kind)", "Billboards abroad"], 0),
        q("'Setting the agenda' means…", ["Printing calendars", "What media cover becomes what people talk about", "Owning a TV station", "Writing laws"], 1),
        q("Which is 'new media'?", ["A podcast", "A town crier", "A printed almanac", "A signpost"], 0),
        q("Which is NOT a usual function of mass media?", ["Inform", "Entertain", "Educate", "Repair cars"], 3),
        q("Because anyone can publish online, it is important to…", ["Share everything fast", "Check sources", "Avoid the news", "Only read headlines"], 1),
      ]),
      c("mac102", "MAC 102", "News Writing", [
        "A news story answers the 5 Ws and H: who, what, when, where, why and how.",
        "News uses the inverted pyramid: the most important facts first, details later, so readers get the point even if they stop early.",
        "Quote people accurately and name your sources. Opinion belongs in an opinion piece, not in a news report.",
      ], [
        q("The 5 Ws of news are who, what, when, where and…", ["Which", "Why", "Wow", "Whose"], 1),
        q("In the inverted pyramid, the most important facts go…", ["At the end", "First", "In the middle", "In the caption"], 1),
        q("Where does a writer's personal opinion belong?", ["In a news report", "In an opinion piece", "In the headline", "In a quote"], 1),
        q("Why name your sources?", ["To fill space", "So readers can trust and check the story", "It's not needed", "To make it longer"], 1),
        q("What does H stand for, with the 5 Ws?", ["Headline", "How", "History", "Host"], 1),
      ]),
      c("mac201", "MAC 201", "Broadcasting", [
        "Radio and TV run on a schedule called a programme lineup; a presenter keeps to time because adverts and the news start on the hour.",
        "Write for the ear: short sentences, simple words, say numbers clearly. Listeners can't scroll back.",
        "Before going live, do a sound check and prepare a running order (the list of items in the show, with timings).",
      ], [
        q("Writing for radio means…", ["Long, complex sentences", "Short sentences and simple words", "Lots of tables", "Using footnotes"], 1),
        q("A running order is…", ["The list of items in a show with timings", "A marathon", "A list of sponsors' phone numbers", "The station's bank account"], 0),
        q("Before going live, a presenter should…", ["Skip the sound check", "Do a sound check", "Turn off the mic", "Leave early"], 1),
        q("Why do presenters keep to time?", ["Adverts and the news start on the hour", "It doesn't matter", "To finish early", "Listeners prefer silence"], 0),
        q("Why write numbers clearly for radio?", ["Listeners can't scroll back", "It looks nice", "Numbers are banned", "To save paper"], 0),
      ]),
      c("mac202", "MAC 202", "Public Relations and Digital Content", [
        "Public relations (PR) builds and protects a reputation through honest communication with the public and the press.",
        "A press release announces news in the inverted-pyramid style, with a clear headline and a contact person.",
        "Good digital content knows its audience, has one clear message and a call to action (follow, visit, buy). Consistency builds an audience.",
      ], [
        q("Public relations is mainly about…", ["Building and protecting reputation", "Fixing computers", "Selling land", "Accounting"], 0),
        q("A press release should include…", ["A contact person", "Secret passwords", "No headline", "Only pictures"], 0),
        q("A 'call to action' asks the audience to…", ["Ignore the post", "Do something: follow, visit or buy", "Call the police", "Close the app"], 1),
        q("What builds an audience over time?", ["Posting once a year", "Consistency", "Random topics only", "No message"], 1),
        q("Good content starts with knowing…", ["Your audience", "Your password", "The weather", "Your shoe size"], 0),
      ]),
    ],
  },
  {
    key: "law",
    degree: "LLB Law",
    faculty: "Faculty of Law",
    icon: "⚖️",
    blurb: "Contracts, rights and the courts. The High Court is on Marina.",
    courses: [
      c("law101", "LAW 101", "Nigerian Legal System", [
        "Nigeria's law comes from the Constitution (the highest law), Acts of the National Assembly, state laws, case law from the courts, and customary and Islamic law.",
        "The courts have a ladder: the Supreme Court is at the top, then the Court of Appeal, then High Courts and lower courts.",
        "If any law conflicts with the Constitution, the Constitution wins and that law is void to the extent of the conflict.",
      ], [
        q("What is the highest law in Nigeria?", ["The Constitution", "A state law", "A bye-law", "A company policy"], 0),
        q("Which is the highest court in Nigeria?", ["High Court", "Magistrate Court", "Supreme Court", "Customary Court"], 2),
        q("If a law conflicts with the Constitution…", ["The law wins", "The Constitution wins", "Both apply", "The judge chooses freely"], 1),
        q("Which comes between the High Court and the Supreme Court?", ["Court of Appeal", "Magistrate Court", "Area Court", "Police station"], 0),
        q("Which is a source of Nigerian law?", ["Case law from the courts", "Newspaper adverts", "Social media trends", "Song lyrics"], 0),
      ]),
      c("law102", "LAW 102", "Law of Contract", [
        "A contract needs an offer, acceptance of that offer, consideration (something of value exchanged) and the intention to be legally bound.",
        "Contracts can be spoken or written, but writing it down makes it far easier to prove what was agreed.",
        "Breaking the terms is a breach of contract; the other side can claim damages (money to put them where they would have been).",
      ], [
        q("Which is NOT needed for a valid contract?", ["Offer", "Acceptance", "Consideration", "A lawyer's stamp"], 3),
        q("'Consideration' in contract law means…", ["Being polite", "Something of value exchanged", "Thinking about it", "A long delay"], 1),
        q("Why put a contract in writing?", ["Spoken contracts are always illegal", "It is easier to prove what was agreed", "To make it longer", "Writing makes it free"], 1),
        q("Not doing what the contract says is…", ["A breach of contract", "An offer", "Consideration", "Acceptance"], 0),
        q("Damages are…", ["Broken goods", "Money to put the other side where they would have been", "A prison term", "A court building"], 1),
      ]),
      c("law201", "LAW 201", "Human Rights", [
        "Chapter IV of the Constitution protects fundamental rights, including the right to life, dignity, personal liberty, a fair hearing, privacy, and freedom of expression.",
        "An arrested person must be told why, has the right to remain silent and to a lawyer, and must be brought before a court within a reasonable time.",
        "A fair hearing means an independent court, hearing both sides before deciding.",
      ], [
        q("Which chapter of the Constitution covers fundamental rights?", ["Chapter I", "Chapter IV", "Chapter IX", "Chapter XII"], 1),
        q("An arrested person has the right to…", ["Stay silent and have a lawyer", "Be held forever without reason", "No explanation", "Pay the officer"], 0),
        q("A fair hearing means…", ["Only one side speaks", "An independent court hears both sides", "The richest side wins", "No court"], 1),
        q("Which is a fundamental right?", ["Freedom of expression", "A free car", "A government job", "Free data"], 0),
        q("After arrest, a person must be brought before a court…", ["Never", "Within a reasonable time", "After ten years", "Only if they pay"], 1),
      ]),
      c("law202", "LAW 202", "Business and Property Law", [
        "A limited liability company is a separate legal person: its debts are the company's, not the owners' personal debts.",
        "Under the Land Use Act, land in each state is held by the State Governor; people hold rights of occupancy, often shown by a Certificate of Occupancy (C of O).",
        "Before buying land, search the land registry, check the seller's title and get a survey plan. Never pay cash without paperwork.",
      ], [
        q("In a limited liability company, the company's debts are…", ["The owners' personal debts", "The company's own", "The bank's", "The customers'"], 1),
        q("Under the Land Use Act, land in a state is held by…", ["The local chief only", "The State Governor", "Anyone who fences it", "The President"], 1),
        q("What does C of O stand for?", ["Certificate of Occupancy", "Council of Owners", "Cost of Ownership", "Certificate of Origin"], 0),
        q("Before buying land you should…", ["Pay cash quickly", "Search the registry and check the title", "Skip the survey", "Trust any seller"], 1),
        q("A company being a 'separate legal person' means…", ["It can own property and be sued in its own name", "It has no owners", "It cannot have debts", "It pays no tax"], 0),
      ]),
    ],
  },
];

export const PROGRAMME_BY_KEY = new Map(PROGRAMMES.map((p) => [p.key, p]));
export const COURSE_BY_KEY = new Map(PROGRAMMES.flatMap((p) => p.courses.map((co) => [co.key, { ...co, programme: p.key }] as const)));

/** What the University card shows you. */
export interface UniCourseView {
  key: string;
  code: string;
  title: string;
  lectures: number;
  passed: boolean;
  attempts: number;
}
export interface UniView {
  /** The programme you're studying now, or null. */
  programme: string | null;
  courses: UniCourseView[];
  lecturesToday: number;
  /** Degrees you hold. */
  degrees: { programme: string; degree: string; at: string }[];
  /** A lecture in progress (server time). */
  lecture: { course: string; index: number; endsAt: string } | null;
}
export interface UniExam {
  course: string;
  questions: { q: string; options: string[] }[];
  fee: number;
}
