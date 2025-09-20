
-- =====================================================
-- БАЗОВЫЕ ПРОВЕРКИ ДАННЫХ
-- =====================================================

-- 1. Проверка структуры таблицы jobs (первые 10 записей)
SELECT * FROM jobs LIMIT 10;

-- 2. Запрос с фильтрацией и сортировкой: топ-10 вакансий по популярности в Калифорнии
SELECT job_id, title, company_id, views, applies
FROM jobs 
WHERE location ILIKE '%california%' 
  AND views > 1000
ORDER BY applies DESC 
LIMIT 10;

-- 3. Агрегация: статистика по компаниям (количество вакансий и средние просмотры)
SELECT 
    c.name as company_name,
    COUNT(j.job_id) as total_jobs,
    AVG(j.views) as avg_views,
    SUM(j.applies) as total_applies
FROM companies c
JOIN jobs j ON c.company_id = j.company_id
GROUP BY c.company_id, c.name
HAVING COUNT(j.job_id) > 5
ORDER BY total_jobs DESC
LIMIT 20;

-- 4. JOIN: связь вакансий, зарплат и компаний
SELECT 
    j.title,
    c.name as company,
    sal.med_salary,
    sal.pay_period,
    j.location
FROM jobs j
JOIN companies c ON j.company_id = c.company_id
JOIN salaries sal ON j.job_id = sal.job_id
WHERE sal.med_salary IS NOT NULL
  AND sal.med_salary > 100000
ORDER BY sal.med_salary DESC
LIMIT 15;

-- =====================================================
-- 10 ТЕМ ДЛЯ АНАЛИТИКИ РЫНКА ТРУДА
-- =====================================================

-- ТЕМА 1: ТОП-10 САМЫХ ВОСТРЕБОВАННЫХ НАВЫКОВ
-- Анализирует, какие навыки встречаются в наибольшем количестве вакансий
SELECT 
    s.skill_name,
    s.skill_abr,
    COUNT(DISTINCT js.job_id)::INTEGER as job_count,
    ROUND(100.0 * COUNT(DISTINCT js.job_id) / (SELECT COUNT(DISTINCT job_id) FROM jobs)::NUMERIC, 2) as demand_percentage
FROM job_skills js
JOIN skills s ON js.skill_id = s.skill_id
GROUP BY s.skill_id, s.skill_name, s.skill_abr
ORDER BY job_count DESC
LIMIT 10;

-- ТЕМА 2: СРЕДНЯЯ ЗАРПЛАТА ПО ОТРАСЛЯМ
-- Показывает, в каких отраслях платят больше всего
SELECT 
    i.industry_name,
    COUNT(DISTINCT ji.job_id) as job_count,
    ROUND(AVG(sal.med_salary)::NUMERIC, 0) as avg_salary,
    ROUND(MIN(sal.med_salary)::NUMERIC, 0) as min_salary,
    ROUND(MAX(sal.med_salary)::NUMERIC, 0) as max_salary
FROM job_industries ji
JOIN industries i ON ji.industry_id = i.industry_id
JOIN jobs j ON ji.job_id = j.job_id
JOIN salaries sal ON j.job_id = sal.job_id
WHERE sal.med_salary IS NOT NULL
GROUP BY i.industry_id, i.industry_name
HAVING COUNT(DISTINCT ji.job_id) > 10
ORDER BY avg_salary DESC
LIMIT 15;

-- ТЕМА 3: КОМПАНИИ С НАИБОЛЬШИМ КОЛИЧЕСТВОМ ВАКАНСИЙ
-- Идентифицирует самых активных работодателей
SELECT 
    c.name,
    c.country,
    c.city,
    COUNT(j.job_id) as total_jobs,
    ROUND(AVG(sal.med_salary)::NUMERIC, 0) as avg_salary,
    SUM(j.applies) as total_applies,
    ROUND(AVG(j.views)::NUMERIC, 0) as avg_views
FROM companies c
JOIN jobs j ON c.company_id = j.company_id
LEFT JOIN salaries sal ON j.job_id = sal.job_id
GROUP BY c.company_id, c.name, c.country, c.city
HAVING COUNT(j.job_id) > 20
ORDER BY total_jobs DESC
LIMIT 20;

-- ТЕМА 4: УДАЛЁННАЯ РАБОТА ПО ОТРАСЛЯМ
-- Анализирует доступность удалённой работы в разных отраслях
SELECT 
    i.industry_name,
    COUNT(DISTINCT ji.job_id) as total_jobs,
    COUNT(DISTINCT CASE WHEN j.remote_allowed = TRUE THEN ji.job_id END) as remote_jobs,
    ROUND(100.0 * COUNT(DISTINCT CASE WHEN j.remote_allowed = TRUE THEN ji.job_id END) / 
          NULLIF(COUNT(DISTINCT ji.job_id), 0)::NUMERIC, 1) as remote_percentage
FROM job_industries ji
JOIN industries i ON ji.industry_id = i.industry_id
JOIN jobs j ON ji.job_id = j.job_id
GROUP BY i.industry_id, i.industry_name
HAVING COUNT(DISTINCT ji.job_id) > 50
ORDER BY remote_percentage DESC
LIMIT 20;

-- ТЕМА 5: ЗАРПЛАТЫ ПО УРОВНЮ ОПЫТА
-- Сравнивает зарплаты для разных уровней seniority
SELECT 
    j.formatted_experience_level,
    COUNT(j.job_id) as job_count,
    ROUND(AVG(sal.med_salary)::NUMERIC, 0) as avg_salary,
    ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY sal.med_salary) ::NUMERIC, 0) as q25_salary,
    ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY sal.med_salary) ::NUMERIC, 0) as q75_salary
FROM jobs j
JOIN salaries sal ON j.job_id = sal.job_id
WHERE j.formatted_experience_level IS NOT NULL
  AND sal.med_salary IS NOT NULL
GROUP BY j.formatted_experience_level
ORDER BY 
    CASE 
        WHEN j.formatted_experience_level ILIKE '%internship%' THEN 1
        WHEN j.formatted_experience_level ILIKE '%entry%' THEN 2
        WHEN j.formatted_experience_level ILIKE '%associate%' THEN 3
        WHEN j.formatted_experience_level ILIKE '%mid%' THEN 4
        WHEN j.formatted_experience_level ILIKE '%senior%' THEN 5
        ELSE 6 
    END;
-- Примечание: Для точного ORDER BY по уровням опыта может потребоваться CASE

-- ТЕМА 6: РЕГИОНАЛЬНЫЙ АНАЛИЗ ЗАРПЛАТ (по штатам США)
-- Показывает разницу в зарплатах между регионами
SELECT 
    SUBSTRING(j.location, 1, POSITION(',' IN j.location) - 1)::VARCHAR(100) as state,
    COUNT(j.job_id) as job_count,
    ROUND(AVG(sal.med_salary)::NUMERIC, 0) as avg_salary,
    ROUND(STDDEV(sal.med_salary)::NUMERIC, 0) as salary_stddev,
    MIN(sal.med_salary)::INTEGER as min_salary,
    MAX(sal.med_salary)::INTEGER as max_salary
FROM jobs j
JOIN salaries sal ON j.job_id = sal.job_id
WHERE j.location ILIKE '%, %'  -- Только штаты США (содержит запятую)
  AND sal.med_salary IS NOT NULL
GROUP BY state
HAVING COUNT(j.job_id) > 30
ORDER BY avg_salary DESC
LIMIT 25;

-- ТЕМА 7: БЕНЕФИТЫ И ИХ РАСПРОСТРАНЁННОСТЬ
-- Анализирует, какие бенефиты предлагают работодатели
SELECT 
    b.type,
    COUNT(DISTINCT b.job_id) as unique_jobs,
    ROUND(100.0 * COUNT(DISTINCT b.job_id) / (SELECT COUNT(DISTINCT job_id) FROM jobs)::NUMERIC, 1) as coverage_percentage,
    COUNT(*) as total_mentions
FROM benefits b
GROUP BY b.type
ORDER BY unique_jobs DESC
LIMIT 20;

-- ТЕМА 8: КОРРЕЛЯЦИЯ МЕЖДУ РАЗМЕРОМ КОМПАНИИ И ЗАРПЛАТАМИ
-- Проверяет, платят ли крупные компании больше
SELECT 
    c.company_size,
    COUNT(DISTINCT j.job_id) as job_count,
    ROUND(AVG(sal.med_salary)::NUMERIC, 0) as avg_salary,
    COUNT(DISTINCT c.company_id) as company_count
FROM companies c
JOIN jobs j ON c.company_id = j.company_id
JOIN salaries sal ON j.job_id = sal.job_id
WHERE c.company_size IS NOT NULL
  AND sal.med_salary IS NOT NULL
GROUP BY c.company_size
ORDER BY 
    CASE 
        WHEN c.company_size ILIKE '%1-10%' THEN 1
        WHEN c.company_size ILIKE '%11-50%' THEN 2
        WHEN c.company_size ILIKE '%51-200%' THEN 3
        WHEN c.company_size ILIKE '%201-500%' THEN 4
        WHEN c.company_size ILIKE '%501-1000%' THEN 5
        WHEN c.company_size ILIKE '%1000-5000%' THEN 6
        WHEN c.company_size ILIKE '%5000-10000%' THEN 7
        WHEN c.company_size ILIKE '%10000+%' THEN 8
        ELSE 9
    END;

-- ТЕМА 9: ТРЕНДЫ ПО СПЕЦИАЛЬНОСТЯМ КОМПАНИЙ
-- Анализирует, какие специализации компаний наиболее востребованы
SELECT 
    cs.speciality,
    COUNT(DISTINCT cs.company_id) as active_companies,
    COUNT(DISTINCT j.job_id) as total_jobs,
    ROUND(AVG(sal.med_salary)::NUMERIC, 0) as avg_salary
FROM company_specialities cs
JOIN companies c ON cs.company_id = c.company_id
JOIN jobs j ON c.company_id = j.company_id
LEFT JOIN salaries sal ON j.job_id = sal.job_id
WHERE j.job_id IS NOT NULL
GROUP BY cs.speciality
HAVING COUNT(DISTINCT cs.company_id) > 5
ORDER BY total_jobs DESC
LIMIT 25;

-- ТЕМА 10: ЭФФЕКТИВНОСТЬ РЕКРУТИНГА (просмотры vs заявки)
-- Оценивает, насколько эффективно компании привлекают кандидатов
SELECT 
    c.name as company_name,
    COUNT(j.job_id) as total_jobs,
    SUM(j.views) as total_views,
    SUM(j.applies) as total_applies,
    ROUND(AVG(j.applies * 1.0 / NULLIF(j.views, 0))::NUMERIC, 4) as apply_to_view_ratio,
    ROUND(AVG(j.views)::NUMERIC, 0) as avg_views_per_job
FROM companies c
JOIN jobs j ON c.company_id = j.company_id
WHERE j.views > 0 AND j.applies > 0
GROUP BY c.company_id, c.name
HAVING COUNT(j.job_id) > 10
ORDER BY apply_to_view_ratio DESC
LIMIT 15;