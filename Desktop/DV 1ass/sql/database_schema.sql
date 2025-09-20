
-- 1. Таблица компаний
CREATE TABLE companies (
    company_id VARCHAR PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    company_size VARCHAR(50),
    state VARCHAR(100),
    country VARCHAR(100),
    city VARCHAR(100),
    zip_code VARCHAR(20),
    address TEXT,
    url VARCHAR(500)
);

-- 2. Таблица отраслей
CREATE TABLE industries (
    industry_id VARCHAR PRIMARY KEY,
    industry_name VARCHAR(255) NOT NULL
);

-- 3. Таблица навыков
CREATE TABLE skills (
    skill_id VARCHAR PRIMARY KEY,
    skill_abr VARCHAR(50) NOT NULL,
    skill_name VARCHAR(255) NOT NULL
);

-- 4. Таблица вакансий
CREATE TABLE jobs (
    job_id VARCHAR PRIMARY KEY,
    company_id VARCHAR,
    title VARCHAR(255),
    description TEXT,
    location VARCHAR(255),
    views INTEGER DEFAULT 0,
    formatted_work_type VARCHAR(50),
    applies INTEGER DEFAULT 0,
    remote_allowed BOOLEAN DEFAULT FALSE,
    formatted_experience_level VARCHAR(50),
    work_type VARCHAR(50),
    zip_code VARCHAR(20),
    FOREIGN KEY (company_id) REFERENCES companies(company_id)
);

-- 5. Таблица бенефитов
CREATE TABLE benefits (
    id SERIAL PRIMARY KEY,
    job_id VARCHAR,
    inferred BOOLEAN,
    type VARCHAR(255),
    FOREIGN KEY (job_id) REFERENCES jobs(job_id)
);

-- 6. Таблица зарплат
CREATE TABLE salaries (
    salary_id VARCHAR PRIMARY KEY,
    job_id VARCHAR,
    max_salary DECIMAL(10,2),
    med_salary DECIMAL(10,2),
    min_salary DECIMAL(10,2),
    pay_period VARCHAR(50),
    currency VARCHAR(10),
    compensation_type VARCHAR(50),
    FOREIGN KEY (job_id) REFERENCES jobs(job_id)
);

-- 7. Таблица количества сотрудников
CREATE TABLE employee_counts (
    id SERIAL PRIMARY KEY,
    company_id VARCHAR,
    employee_count INTEGER,
    follower_count INTEGER,
    time_recorded TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(company_id)
);

-- 8. Таблица специальностей компаний
CREATE TABLE company_specialities (
    id SERIAL PRIMARY KEY,
    company_id VARCHAR,
    speciality VARCHAR(255),
    FOREIGN KEY (company_id) REFERENCES companies(company_id)
);

-- 9. Таблица связи вакансий с отраслями
CREATE TABLE job_industries (
    id SERIAL PRIMARY KEY,
    job_id VARCHAR,
    industry_id VARCHAR,
    FOREIGN KEY (job_id) REFERENCES jobs(job_id),
    FOREIGN KEY (industry_id) REFERENCES industries(industry_id)
);

-- 10. Таблица связи компаний с отраслями
CREATE TABLE company_industries (
    id SERIAL PRIMARY KEY,
    company_id VARCHAR,
    industry_id VARCHAR,
    FOREIGN KEY (company_id) REFERENCES companies(company_id),
    FOREIGN KEY (industry_id) REFERENCES industries(industry_id)
);

-- 11. Таблица связи вакансий с навыками
CREATE TABLE job_skills (
    id SERIAL PRIMARY KEY,
    job_id VARCHAR,
    skill_id VARCHAR,
    FOREIGN KEY (job_id) REFERENCES jobs(job_id),
    FOREIGN KEY (skill_id) REFERENCES skills(skill_id)
);

-- ИНДЕКСЫ ДЛЯ ОПТИМИЗАЦИИ
CREATE INDEX idx_jobs_company_id ON jobs(company_id);
CREATE INDEX idx_jobs_location ON jobs(location);
CREATE INDEX idx_salaries_job_id ON salaries(job_id);
CREATE INDEX idx_job_skills_job_id ON job_skills(job_id);
CREATE INDEX idx_job_skills_skill_id ON job_skills(skill_id);
CREATE INDEX idx_job_industries_job_id ON job_industries(job_id);
CREATE INDEX idx_employee_counts_company_id ON employee_counts(company_id);