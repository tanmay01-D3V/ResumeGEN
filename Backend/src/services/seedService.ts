import type { PortfolioRecordInput, UserProfile } from '../../../shared/schemas';
import type { Repository } from '../repositories';
import { newId, nowIso } from '../utils/ids';
import type { PortfolioRecord, JobDescription } from '../../../shared/schemas';
import { heuristicAnalyzeJobDescription } from './heuristicJd';

const SAMPLE_TAG = 'sample-data';

export const DEMO_JD_ML = `Machine Learning Engineer — Northstar Analytics (fictional demo company)

About the role
You will build and evaluate machine learning models that help retail teams understand customer behaviour. You will work with data engineers and product managers to turn messy data into reliable, explainable predictions.

Responsibilities
- Design, train and evaluate machine learning models using Python and scikit-learn.
- Perform data preprocessing, feature engineering and exploratory analysis with pandas and NumPy.
- Evaluate models with appropriate validation strategies and communicate limitations clearly.
- Collaborate with product and engineering teams to integrate models into internal tools.
- Document experiments and present findings to non-technical stakeholders.

Required qualifications
- Bachelor's degree in Computer Science, Data Science or a related field.
- 0-2 years of experience building machine learning projects, including academic or internship work.
- Strong Python programming skills.
- Solid understanding of machine learning fundamentals, data preprocessing and model evaluation.
- Experience with scikit-learn and pandas.
- At least one relevant machine learning project.
- Strong communication and analytical skills.

Preferred qualifications
- Experience with TensorFlow or PyTorch.
- Familiarity with Docker and SQL.
- Experience deploying a model or data pipeline.
- Exposure to AWS is a plus.
- AWS Certified Machine Learning – Specialty certification is nice to have.

We evaluate every candidate on evidence of their work. Please include project context and measurable results where available.`;

export const DEMO_JD_FULLSTACK = `Full-Stack Developer — Bluewave Labs (fictional demo company)

About the role
Join a small product team building customer-facing web applications. You will own features from database schema through React interface and REST API, and work closely with designers and QA.

Responsibilities
- Build responsive user interfaces with React, JavaScript or TypeScript.
- Develop REST APIs with Node.js and Express.js.
- Design relational and document database schemas, and write efficient queries.
- Integrate frontend and backend services, including authentication and validation.
- Write maintainable code, review pull requests and use Git for version control.
- Collaborate with designers, QA and product managers in an agile team.

Required qualifications
- Bachelor's degree in Computer Science, Software Engineering or equivalent practical experience.
- 0-2 years of experience building web applications, including academic or internship projects.
- Strong JavaScript or TypeScript skills.
- Hands-on experience with React, Node.js and Express.js.
- Understanding of REST APIs and database design using SQL or PostgreSQL.
- Experience with Git and collaborative development.
- At least one relevant web application project.
- Good communication and teamwork skills.

Preferred qualifications
- Experience with Docker or AWS.
- Familiarity with automated testing.
- Exposure to MongoDB is a plus.
- Meta Front-End Developer Professional Certificate is preferred but not required.

Applications without a portfolio or project evidence are difficult to assess. Show what you built and the decisions you made.`;

const DEMO_RECORDS: PortfolioRecordInput[] = [
  {
    category: 'personal_info',
    title: 'Aarav Mehta',
    tags: [SAMPLE_TAG],
    sourceType: 'seed',
    verificationStatus: 'verified',
    data: {
      fullName: 'Aarav Mehta',
      headline: 'Computer Science Graduate | Machine Learning & Full-Stack Projects',
      email: 'aarav.mehta@example.com',
      phone: '+91 00000 00000',
      location: 'Pune, India (fictional)',
      linkedinUrl: 'https://linkedin.com/in/aarav-mehta-demo',
      githubUrl: 'https://github.com/aarav-mehta-demo',
      portfolioUrl: 'https://aarav-mehta.example.com',
    },
  },
  {
    category: 'summary',
    title: 'Computer Science Graduate — ML and Web',
    tags: [SAMPLE_TAG],
    sourceType: 'seed',
    verificationStatus: 'verified',
    data: {
      headline: 'Computer Science Graduate | ML and Web Development',
      summaryText:
        'Computer science graduate with hands-on project experience in machine learning and full-stack web development. Built an end-to-end churn prediction pipeline in Python and a TypeScript/React event platform backed by PostgreSQL. Comfortable turning ambiguous requirements into tested, documented features and explaining technical trade-offs to non-technical stakeholders. Seeking an entry-level role where verified project work can contribute to a data or product team. (Fictional sample profile.)',
      careerObjective:
        'Apply verified machine learning and web engineering skills in an entry-level product team.',
      preferredRoles: ['Machine Learning Engineer', 'Full-Stack Developer', 'Data Analyst'],
    },
  },
  {
    category: 'education',
    title: 'B.Tech, Computer Science — Fictional Institute of Technology',
    tags: [SAMPLE_TAG, 'education'],
    sourceType: 'seed',
    verificationStatus: 'verified',
    data: {
      institution: 'Fictional Institute of Technology, Pune',
      degree: 'Bachelor of Technology (B.Tech)',
      fieldOfStudy: 'Computer Science and Engineering',
      startDate: '2020-08',
      endDate: '2024-05',
      grade: '8.7 / 10 CGPA',
      coursework: ['Machine Learning', 'Database Management Systems', 'Data Structures and Algorithms', 'Web Technologies', 'Statistics'],
      description: 'Four-year undergraduate programme. Sample data for demonstration only.',
    },
  },
  {
    category: 'technical_skills',
    title: 'Python',
    tags: [SAMPLE_TAG, 'ml'],
    sourceType: 'seed',
    verificationStatus: 'verified',
    data: {
      name: 'Python',
      category: 'Languages',
      proficiency: 'Advanced',
      yearsExperience: 3,
      evidence: ['Churn prediction pipeline', 'Support ticket classifier', 'Data cleaning internship'],
      relatedProjects: ['Churn Prediction Pipeline', 'Support Ticket Classifier'],
    },
  },
  {
    category: 'technical_skills',
    title: 'JavaScript',
    tags: [SAMPLE_TAG, 'web'],
    sourceType: 'seed',
    verificationStatus: 'verified',
    data: { name: 'JavaScript', category: 'Languages', proficiency: 'Advanced', evidence: ['CampusConnect event platform'] },
  },
  {
    category: 'technical_skills',
    title: 'TypeScript',
    tags: [SAMPLE_TAG, 'web'],
    sourceType: 'seed',
    verificationStatus: 'verified',
    data: { name: 'TypeScript', category: 'Languages', proficiency: 'Intermediate', evidence: ['CampusConnect frontend'] },
  },
  {
    category: 'technical_skills',
    title: 'React',
    tags: [SAMPLE_TAG, 'web'],
    sourceType: 'seed',
    verificationStatus: 'verified',
    data: { name: 'React', category: 'Web', proficiency: 'Advanced', evidence: ['CampusConnect event platform'] },
  },
  {
    category: 'technical_skills',
    title: 'Node.js',
    tags: [SAMPLE_TAG, 'web'],
    sourceType: 'seed',
    verificationStatus: 'verified',
    data: { name: 'Node.js', category: 'Web', proficiency: 'Intermediate', evidence: ['CampusConnect REST API'] },
  },
  {
    category: 'technical_skills',
    title: 'Express.js',
    tags: [SAMPLE_TAG, 'web'],
    sourceType: 'seed',
    verificationStatus: 'verified',
    data: { name: 'Express.js', category: 'Web', proficiency: 'Intermediate', evidence: ['CampusConnect REST API'] },
  },
  {
    category: 'technical_skills',
    title: 'REST APIs',
    tags: [SAMPLE_TAG, 'web'],
    sourceType: 'seed',
    verificationStatus: 'verified',
    data: { name: 'REST APIs', category: 'Web', proficiency: 'Intermediate', evidence: ['CampusConnect API with validation and pagination'] },
  },
  {
    category: 'technical_skills',
    title: 'PostgreSQL',
    tags: [SAMPLE_TAG, 'web', 'data'],
    sourceType: 'seed',
    verificationStatus: 'verified',
    data: { name: 'PostgreSQL', category: 'Databases', proficiency: 'Intermediate', evidence: ['CampusConnect schema and queries'] },
  },
  {
    category: 'technical_skills',
    title: 'SQL',
    tags: [SAMPLE_TAG, 'data'],
    sourceType: 'seed',
    verificationStatus: 'verified',
    data: { name: 'SQL', category: 'Databases', proficiency: 'Intermediate', evidence: ['Reporting queries during data analyst internship'] },
  },
  {
    category: 'technical_skills',
    title: 'MongoDB',
    tags: [SAMPLE_TAG, 'web'],
    sourceType: 'seed',
    verificationStatus: 'verified',
    data: { name: 'MongoDB', category: 'Databases', proficiency: 'Beginner', evidence: ['Course project prototype'] },
  },
  {
    category: 'technical_skills',
    title: 'scikit-learn',
    tags: [SAMPLE_TAG, 'ml'],
    sourceType: 'seed',
    verificationStatus: 'verified',
    data: { name: 'scikit-learn', category: 'Machine Learning', proficiency: 'Advanced', evidence: ['Churn prediction pipeline', 'Support ticket classifier'] },
  },
  {
    category: 'technical_skills',
    title: 'pandas',
    tags: [SAMPLE_TAG, 'ml'],
    sourceType: 'seed',
    verificationStatus: 'verified',
    data: { name: 'pandas', category: 'Machine Learning', proficiency: 'Advanced', evidence: ['Data preprocessing in both ML projects'] },
  },
  {
    category: 'technical_skills',
    title: 'NumPy',
    tags: [SAMPLE_TAG, 'ml'],
    sourceType: 'seed',
    verificationStatus: 'verified',
    data: { name: 'NumPy', category: 'Machine Learning', proficiency: 'Intermediate', evidence: ['Feature engineering notebooks'] },
  },
  {
    category: 'technical_skills',
    title: 'TensorFlow',
    tags: [SAMPLE_TAG, 'ml'],
    sourceType: 'seed',
    verificationStatus: 'verified',
    data: { name: 'TensorFlow', category: 'Machine Learning', proficiency: 'Beginner', evidence: ['Course exercise only; no production use'] },
  },
  {
    category: 'technical_skills',
    title: 'Data Preprocessing',
    tags: [SAMPLE_TAG, 'ml'],
    sourceType: 'seed',
    verificationStatus: 'verified',
    data: { name: 'Data Preprocessing', category: 'Machine Learning', evidence: ['Handled missing values and categorical encoding in churn pipeline'] },
  },
  {
    category: 'technical_skills',
    title: 'Model Evaluation',
    tags: [SAMPLE_TAG, 'ml'],
    sourceType: 'seed',
    verificationStatus: 'verified',
    data: { name: 'Model Evaluation', category: 'Machine Learning', evidence: ['Stratified cross-validation and held-out test set'] },
  },
  {
    category: 'technical_skills',
    title: 'Git',
    tags: [SAMPLE_TAG, 'engineering'],
    sourceType: 'seed',
    verificationStatus: 'verified',
    data: { name: 'Git', category: 'Engineering', proficiency: 'Intermediate', evidence: ['Feature branches and pull requests in team coursework'] },
  },
  {
    category: 'technical_skills',
    title: 'Docker',
    tags: [SAMPLE_TAG, 'engineering'],
    sourceType: 'seed',
    verificationStatus: 'verified',
    data: { name: 'Docker', category: 'Engineering', proficiency: 'Beginner', evidence: ['Containerised a Flask exercise locally'] },
  },
  {
    category: 'technical_skills',
    title: 'Microsoft Excel',
    tags: [SAMPLE_TAG, 'data'],
    sourceType: 'seed',
    verificationStatus: 'verified',
    data: { name: 'Microsoft Excel', category: 'Analytics', proficiency: 'Intermediate', evidence: ['Weekly reporting internship'] },
  },
  {
    category: 'soft_skills',
    title: 'Communication',
    tags: [SAMPLE_TAG],
    sourceType: 'seed',
    verificationStatus: 'verified',
    data: { name: 'Communication', evidence: 'Presented project findings to a 20-person student audience and wrote handover documentation for a team project.' },
  },
  {
    category: 'soft_skills',
    title: 'Problem Solving',
    tags: [SAMPLE_TAG],
    sourceType: 'seed',
    verificationStatus: 'verified',
    data: { name: 'Problem Solving', evidence: 'Diagnosed a data leakage issue that had inflated model accuracy during cross-validation.' },
  },
  {
    category: 'soft_skills',
    title: 'Analytical Skills',
    tags: [SAMPLE_TAG],
    sourceType: 'seed',
    verificationStatus: 'verified',
    data: { name: 'Analytical Skills', evidence: 'Compared models using precision, recall and confusion matrices rather than accuracy alone.' },
  },
  {
    category: 'soft_skills',
    title: 'Teamwork',
    tags: [SAMPLE_TAG],
    sourceType: 'seed',
    verificationStatus: 'verified',
    data: { name: 'Teamwork', evidence: 'Worked in a three-person team with Git-based code review for CampusConnect.' },
  },
  {
    category: 'projects',
    title: 'Churn Prediction Pipeline',
    tags: [SAMPLE_TAG, 'ml', 'python'],
    sourceType: 'seed',
    verificationStatus: 'verified',
    data: {
      name: 'Churn Prediction Pipeline',
      role: 'Solo project',
      description:
        'Built an end-to-end customer churn prediction pipeline that cleans raw subscription data, engineers behavioural features and compares logistic regression, random forest and gradient boosting models.',
      problemSolved:
        'The sample dataset had missing tenure values and class imbalance, which made naive accuracy misleading.',
      technologies: ['Python', 'scikit-learn', 'pandas', 'NumPy', 'Matplotlib'],
      responsibilities: [
        'Profiled and cleaned 7,000+ synthetic customer records.',
        'Built preprocessing pipelines with median imputation, one-hot encoding and scaling.',
        'Compared models using stratified 5-fold cross-validation.',
      ],
      achievements: [
        'Selected a gradient boosting model after comparing precision and recall.',
        'Documented leakage checks and evaluation limitations in the project README.',
      ],
      metrics: ['0.89 ROC-AUC on a held-out test set', 'Reduced manual data-cleaning steps from 11 to 4'],
      startDate: '2023-09',
      endDate: '2023-12',
      repoUrl: 'https://github.com/aarav-mehta-demo/churn-pipeline',
      demoUrl: 'https://churn-demo.example.com',
    },
  },
  {
    category: 'projects',
    title: 'Support Ticket Classifier',
    tags: [SAMPLE_TAG, 'ml', 'nlp'],
    sourceType: 'seed',
    verificationStatus: 'verified',
    data: {
      name: 'Support Ticket Classifier',
      role: 'Two-person project',
      description:
        'Trained a text classifier that routes support tickets into billing, technical and account categories using TF-IDF features and scikit-learn models.',
      problemSolved: 'Manual triage delayed responses to urgent technical tickets.',
      technologies: ['Python', 'scikit-learn', 'pandas', 'NLP'],
      responsibilities: [
        'Cleaned and de-duplicated 4,200 synthetic ticket texts.',
        'Compared multinomial naive Bayes and linear SVM baselines.',
        'Built a small evaluation report with per-class metrics.',
      ],
      achievements: ['Improved macro F1 from 0.71 to 0.84 with class weighting and n-gram features.'],
      metrics: ['0.84 macro F1 on a stratified holdout set'],
      startDate: '2024-01',
      endDate: '2024-03',
      repoUrl: 'https://github.com/aarav-mehta-demo/ticket-classifier',
    },
  },
  {
    category: 'projects',
    title: 'CampusConnect Event Platform',
    tags: [SAMPLE_TAG, 'web', 'fullstack'],
    sourceType: 'seed',
    verificationStatus: 'verified',
    data: {
      name: 'CampusConnect Event Platform',
      role: 'Full-stack developer (team of three)',
      description:
        'Built a responsive event discovery and registration platform for a fictional university, with an accessible React interface and a typed REST API.',
      problemSolved: 'Event information was spread across chat groups and spreadsheets, causing duplicate registrations.',
      technologies: ['React', 'TypeScript', 'Node.js', 'Express.js', 'PostgreSQL', 'REST APIs', 'Git'],
      responsibilities: [
        'Designed the PostgreSQL schema for events, users and registrations with foreign-key constraints.',
        'Implemented REST endpoints with request validation and pagination.',
        'Built reusable React components and handled loading, empty and error states.',
      ],
      achievements: [
        'Added database constraints that prevented duplicate registrations in integration tests.',
        'Wrote a setup guide so teammates could run the stack locally.',
      ],
      metrics: ['Supported 500+ synthetic student registrations during a load test'],
      startDate: '2024-01',
      endDate: '2024-04',
      repoUrl: 'https://github.com/aarav-mehta-demo/campusconnect',
      demoUrl: 'https://campusconnect.example.com',
    },
  },
  {
    category: 'experience',
    title: 'Data Analyst Intern at Meridian Retail Insights',
    tags: [SAMPLE_TAG, 'data', 'internship'],
    sourceType: 'seed',
    verificationStatus: 'verified',
    data: {
      organization: 'Meridian Retail Insights (fictional)',
      jobTitle: 'Data Analyst Intern',
      employmentType: 'Internship',
      location: 'Remote',
      startDate: '2023-06',
      endDate: '2023-08',
      current: false,
      responsibilities: [
        'Cleaned weekly sales extracts with Python and pandas.',
        'Wrote SQL queries for category-level reporting.',
        'Prepared Excel summaries for a fictional operations team.',
      ],
      achievements: ['Reduced a recurring weekly report preparation task from about six hours to 90 minutes by scripting the cleaning steps.'],
      technologies: ['Python', 'pandas', 'SQL', 'Microsoft Excel'],
      metrics: ['Weekly reporting time reduced from ~6 hours to 90 minutes (sample data)'],
    },
  },
  {
    category: 'experience',
    title: 'Web Development Intern at CodeCraft Studio',
    tags: [SAMPLE_TAG, 'web', 'internship'],
    sourceType: 'seed',
    verificationStatus: 'verified',
    data: {
      organization: 'CodeCraft Studio (fictional)',
      jobTitle: 'Web Development Intern',
      employmentType: 'Internship',
      location: 'Pune, India (fictional)',
      startDate: '2024-06',
      endDate: '2024-08',
      current: false,
      responsibilities: [
        'Implemented React components for a fictional client dashboard.',
        'Added Express.js endpoints and Zod request validation.',
        'Fixed accessibility issues found in keyboard-navigation testing.',
      ],
      achievements: ['Closed 14 tracked UI defects during the internship, including focus-order issues.'],
      technologies: ['React', 'JavaScript', 'Node.js', 'Express.js', 'REST APIs', 'Git'],
      metrics: ['14 tracked UI defects resolved (sample data)'],
    },
  },
  {
    category: 'certifications',
    title: 'Machine Learning Specialization (Sample Credential)',
    tags: [SAMPLE_TAG, 'ml'],
    sourceType: 'seed',
    verificationStatus: 'verified',
    data: {
      name: 'Machine Learning Specialization (Sample Credential)',
      issuer: 'Example Learning Platform',
      issueDate: '2023-05',
      credentialId: 'DEMO-ML-0001',
      credentialUrl: 'https://example.com/credentials/DEMO-ML-0001',
      description: 'Fictional certification used only for this demonstration. Not a real credential.',
    },
  },
  {
    category: 'certifications',
    title: 'Front-End Development Certificate (Sample Credential)',
    tags: [SAMPLE_TAG, 'web'],
    sourceType: 'seed',
    verificationStatus: 'verified',
    data: {
      name: 'Front-End Development Certificate (Sample Credential)',
      issuer: 'Example Learning Platform',
      issueDate: '2024-02',
      credentialId: 'DEMO-FE-0002',
      credentialUrl: 'https://example.com/credentials/DEMO-FE-0002',
      description: 'Fictional certification used only for this demonstration. Not a real credential.',
    },
  },
  {
    category: 'achievements',
    title: 'First Place — Campus Data Challenge (Fictional)',
    tags: [SAMPLE_TAG],
    sourceType: 'seed',
    verificationStatus: 'verified',
    data: {
      title: 'First Place — Campus Data Challenge (Fictional)',
      organization: 'Fictional Institute of Technology',
      date: '2023-11',
      description: 'Team placed first in a 24-hour analytics challenge using a synthetic retail dataset.',
      metric: '1st of 18 teams',
    },
  },
  {
    category: 'achievements',
    title: 'Merit Scholarship (Fictional)',
    tags: [SAMPLE_TAG],
    sourceType: 'seed',
    verificationStatus: 'verified',
    data: {
      title: 'Merit Scholarship (Fictional)',
      organization: 'Fictional Institute of Technology',
      date: '2022-08',
      description: 'Awarded for academic performance in the previous academic year.',
      metric: 'Top 10% of cohort',
    },
  },
  {
    category: 'publications',
    title: 'A Lightweight Approach to Student Churn Prediction (Demo)',
    tags: [SAMPLE_TAG, 'ml'],
    sourceType: 'seed',
    verificationStatus: 'verified',
    data: {
      title: 'A Lightweight Approach to Student Churn Prediction (Demo)',
      authors: ['Aarav Mehta', 'Priya Nair'],
      venue: 'Journal of Fictional Computing Education (demo)',
      date: '2024-04',
      doi: '10.0000/demo.2024.001',
      url: 'https://example.com/demo-paper',
      description:
        'A fictional student paper comparing logistic regression and gradient boosting on a synthetic retention dataset. Included for demonstration purposes only.',
    },
  },
  {
    category: 'extracurriculars',
    title: 'Technical Lead — Coding Club',
    tags: [SAMPLE_TAG],
    sourceType: 'seed',
    verificationStatus: 'verified',
    data: {
      role: 'Technical Lead',
      organization: 'Coding Club, Fictional Institute of Technology',
      startDate: '2022-08',
      endDate: '2024-04',
      description: 'Ran monthly Git and Python workshops for 25-30 students and reviewed beginner pull requests.',
    },
  },
  {
    category: 'languages',
    title: 'English',
    tags: [SAMPLE_TAG],
    sourceType: 'seed',
    verificationStatus: 'verified',
    data: { name: 'English', proficiency: 'Professional working proficiency' },
  },
  {
    category: 'languages',
    title: 'Hindi',
    tags: [SAMPLE_TAG],
    sourceType: 'seed',
    verificationStatus: 'verified',
    data: { name: 'Hindi', proficiency: 'Native' },
  },
  {
    category: 'languages',
    title: 'Marathi',
    tags: [SAMPLE_TAG],
    sourceType: 'seed',
    verificationStatus: 'verified',
    data: { name: 'Marathi', proficiency: 'Conversational' },
  },
  {
    category: 'competencies',
    title: 'Technical Writing',
    tags: [SAMPLE_TAG],
    sourceType: 'seed',
    verificationStatus: 'verified',
    data: { name: 'Technical Writing', description: 'Project READMEs, setup guides and experiment reports.', level: 'Intermediate' },
  },
  {
    category: 'competencies',
    title: 'Experiment Design',
    tags: [SAMPLE_TAG],
    sourceType: 'seed',
    verificationStatus: 'verified',
    data: { name: 'Experiment Design', description: 'Train/validation/test splits, cross-validation and leakage checks.', level: 'Intermediate' },
  },
];

export async function seedDemoData(
  repo: Repository,
  user: Pick<UserProfile, 'uid' | 'email' | 'displayName'>,
): Promise<{
  portfolioCreated: number;
  portfolioSkipped: number;
  jobDescriptionsCreated: number;
  jobDescriptionsSkipped: number;
  message: string;
}> {
  const timestamp = nowIso();
  await repo.upsertUser({
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    createdAt: timestamp,
    lastLoginAt: timestamp,
    authMode: user.uid.startsWith('demo_') ? 'demo' : 'firebase',
  });

  const existing = await repo.listPortfolio(user.uid);
  const existingKeys = new Set(
    existing.map((record) => `${record.category}:${record.title.trim().toLowerCase()}`),
  );
  const singletonCategories = new Set(
    existing
      .filter((record) => ['personal_info', 'summary'].includes(record.category))
      .map((record) => record.category),
  );

  let portfolioCreated = 0;
  let portfolioSkipped = 0;
  for (const candidate of DEMO_RECORDS) {
    const key = `${candidate.category}:${candidate.title.trim().toLowerCase()}`;
    if (
      existingKeys.has(key) ||
      (['personal_info', 'summary'].includes(candidate.category) &&
        singletonCategories.has(candidate.category))
    ) {
      portfolioSkipped += 1;
      continue;
    }
    const record: PortfolioRecord = {
      id: newId('seed_'),
      category: candidate.category,
      title: candidate.title,
      data: candidate.data,
      tags: candidate.tags,
      sourceType: 'seed',
      verificationStatus: candidate.verificationStatus,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await repo.createPortfolio(user.uid, record);
    portfolioCreated += 1;
  }

  const existingJobs = await repo.listJobDescriptions(user.uid);
  const jobTitles = new Set(existingJobs.map((job) => job.jobTitle.trim().toLowerCase()));
  const demoJobs: Array<{ title: string; company: string; text: string }> = [
    {
      title: 'Machine Learning Engineer',
      company: 'Northstar Analytics (fictional)',
      text: DEMO_JD_ML,
    },
    {
      title: 'Full-Stack Developer',
      company: 'Bluewave Labs (fictional)',
      text: DEMO_JD_FULLSTACK,
    },
  ];
  let jobDescriptionsCreated = 0;
  let jobDescriptionsSkipped = 0;
  for (const job of demoJobs) {
    if (jobTitles.has(job.title.toLowerCase())) {
      jobDescriptionsSkipped += 1;
      continue;
    }
    const analysis = heuristicAnalyzeJobDescription({
      rawText: job.text,
      jobTitle: job.title,
      company: job.company,
    });
    const record: JobDescription = {
      id: newId('jd_'),
      jobTitle: job.title,
      company: job.company,
      rawText: job.text,
      analysis,
      analysisTimestamp: timestamp,
      analysisEngine: 'heuristic',
      schemaVersion: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await repo.createJobDescription(user.uid, record);
    jobDescriptionsCreated += 1;
  }

  if (portfolioCreated > 0) await repo.markPortfolioChanged(user.uid);

  return {
    portfolioCreated,
    portfolioSkipped,
    jobDescriptionsCreated,
    jobDescriptionsSkipped,
    message:
      'Sample data is fictional and labelled with sample-data tags. Existing records were not overwritten.',
  };
}
