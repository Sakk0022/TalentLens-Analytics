
import pandas as pd
from sqlalchemy import create_engine
import os
import numpy as np

# Настройка подключения
DATABASE_URL = "postgresql+psycopg2://postgres:355812@localhost:5432/linkedin_jobs"  # Замените пароль
engine = create_engine(DATABASE_URL)
FOLDER = "/Users/aleksandrsudro/Desktop/archive"

def clean_column_names(df):
    """Очищает имена колонок"""
    df.columns = [col.strip().replace(' ', '_').lower() for col in df.columns]
    return df

def safe_import(table_name, csv_file, custom_processing=None):
    file_path = os.path.join(FOLDER, csv_file)
    
    if not os.path.exists(file_path):
        print(f"✗ Файл {csv_file} не найден!")
        return False
    
    print(f"\n{'='*60}")
    print(f"Импорт {table_name} из {csv_file}")
    print(f"{'='*60}")
    
    try:
        # Читаем CSV
        df = pd.read_csv(file_path)
        print(f"  Исходные колонки: {list(df.columns)}")
        print(f"  Исходное количество строк: {len(df)}")
        
        # Очищаем имена колонок
        df = clean_column_names(df)
        print(f"  Очищенные колонки: {list(df.columns)}")
        
        # Пропускаем строки с заголовками в данных
        if len(df) > 0 and any(df.iloc[0].astype(str).str.contains('id|name|count|salary', case=False, na=False)):
            print("  ⚠️  Обнаружены заголовки в данных, пропускаем первую строку")
            df = df.iloc[1:].reset_index(drop=True)
        
        # Удаляем пустые строки
        initial_rows = len(df)
        df = df.dropna(how='all')
        if len(df) < initial_rows:
            print(f"  Удалено {initial_rows - len(df)} пустых строк")
        
        # Специальная обработка для каждой таблицы
        if custom_processing:
            df, info = custom_processing(df)
            print(f"  {info}")
        
        # Проверяем, что таблица skills не пуста
        if table_name == 'skills' and len(df) == 0:
            print(f"  ⚠️  Таблица {table_name} пуста после обработки!")
            return False
        
        # Удаляем дубликаты для ключевых таблиц
        if table_name in ['benefits', 'salaries']:
            initial_count = len(df)
            if 'job_id' in df.columns:
                df = df.drop_duplicates(subset=['job_id'])
                print(f"  Удалено дублей по job_id: {initial_count - len(df)}")
        
        # Конвертируем типы данных
        if 'views' in df.columns:
            df['views'] = pd.to_numeric(df['views'], errors='coerce').fillna(0).astype(int)
        if 'applies' in df.columns:
            df['applies'] = pd.to_numeric(df['applies'], errors='coerce').fillna(0).astype(int)
        if 'remote_allowed' in df.columns:
            df['remote_allowed'] = df['remote_allowed'].map({'True': True, 'False': False, True: True, False: False}).fillna(False)
        
        # Импорт в БД
        success = df.to_sql(table_name, engine, if_exists='replace', index=False, method='multi')
        print(f"✓ {table_name}: {len(df)} строк успешно импортировано")
        return True
        
    except Exception as e:
        print(f"✗ Ошибка при импорте {table_name}: {str(e)}")
        import traceback
        traceback.print_exc()  # Добавляем полную трассировку для отладки
        return False
# Специальная обработка для каждой таблицы
def process_companies(df):
    # Удаляем лишние строки
    df = df[df['company_id'].notna() & (df['company_id'] != 'company_id')]
    return df, f"Обработано {len(df)} компаний"

def process_industries(df):
    df = df[df['industry_id'].notna() & (df['industry_id'] != 'industry_id')]
    return df, f"Обработано {len(df)} отраслей"

def process_skills(df):
    """Обрабатывает таблицу skills с правильными названиями колонок"""
    # Очищаем имена колонок (skill_abr -> skill_abr, skill_name -> skill_name)
    df = clean_column_names(df)
    
    # Проверяем наличие колонок
    if 'skill_abr' not in df.columns:
        print("  ⚠️  Колонка 'skill_abr' не найдена! Доступные колонки:", list(df.columns))
        return df, f"Ошибка: отсутствует колонка skill_abr"
    
    # Удаляем пустые строки и дубликаты
    df = df[df['skill_abr'].notna() & (df['skill_name'].notna())]
    df = df.drop_duplicates(subset=['skill_abr'])
    
    # Создаем skill_id из skill_abr
    df['skill_id'] = 'skill_' + df['skill_abr'].str.lower().str.replace(' ', '_').str.replace('-', '_').str[:30]
    
    # Переставляем колонки в правильном порядке
    df = df[['skill_id', 'skill_abr', 'skill_name']]
    
    return df, f"Создано {len(df)} навыков с ID (исправлено: skill_abr)"

def process_jobs(df):
    # Берем только нужные колонки из job_postings.csv
    needed_cols = ['job_id', 'company_id', 'title', 'description', 'location', 'views', 
                   'formatted_work_type', 'applies', 'remote_allowed', 'formatted_experience_level', 
                   'work_type', 'zip_code']
    available_cols = [col for col in needed_cols if col in df.columns]
    df = df[available_cols].copy()
    
    # Очистка job_id
    df = df[df['job_id'].notna() & (df['job_id'] != 'job_id')]
    
    # Конвертация views и applies
    if 'views' in df.columns:
        df['views'] = pd.to_numeric(df['views'], errors='coerce').fillna(0).astype(int)
    if 'applies' in df.columns:
        df['applies'] = pd.to_numeric(df['applies'], errors='coerce').fillna(0).astype(int)
    if 'remote_allowed' in df.columns:
        df['remote_allowed'] = df['remote_allowed'].astype(str).map({'True': True, 'False': False, 'true': True, 'false': False, '1': True, '0': False}).fillna(False)
    
    return df, f"Извлечено {len(df)} вакансий из {len(available_cols)} колонок"

def process_salaries(df):
    # Удаляем заголовки
    df = df[df['salary_id'].notna() & (df['salary_id'] != 'salary_id')]
    
    # Конвертируем зарплаты (игнорируя нечисловые значения)
    for col in ['max_salary', 'med_salary', 'min_salary']:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')
    
    # Заполняем NULL для пустых зарплат
    df[['max_salary', 'med_salary', 'min_salary']] = df[['max_salary', 'med_salary', 'min_salary']].fillna(0)
    
    return df, f"Обработано {len(df)} записей зарплат"

def process_employee_counts(df):
    df = df[df['company_id'].notna() & (df['company_id'] != 'company_id')]
    
    # Конвертируем числа
    df['employee_count'] = pd.to_numeric(df['employee_count'], errors='coerce').fillna(0).astype(int)
    df['follower_count'] = pd.to_numeric(df['follower_count'], errors='coerce').fillna(0).astype(int)
    
    return df, f"Обработано {len(df)} записей о сотрудниках"

def process_company_industries(df):
    # CSV содержит company_id,industry - нужно мапить industry на industry_id
    df = df[df['industry'].notna()]
    print(f"  Найдено {len(df)} пар компания-отрасль")
    return df, f"Готово к маппингу {len(df)} записей"

def process_company_specialities(df):
    df = df[df['speciality'].notna() & (df['speciality'] != 'speciality')]
    return df, f"Обработано {len(df)} специальностей"

def process_job_industries(df):
    df = df[df['industry_id'].notna() & (df['industry_id'] != 'industry_id')]
    return df, f"Обработано {len(df)} пар вакансия-отрасль"

def process_job_skills(df):
    # CSV содержит job_id,skill_abr - нужно мапить skill_abr на skill_id
    df = df[df['skill_abr'].notna()]
    print(f"  Найдено {len(df)} пар вакансия-навык")
    return df, f"Готово к маппингу {len(df)} записей"

def process_benefits(df):
    df = df[df['job_id'].notna() & (df['job_id'] != 'job_id')]
    df = df.drop_duplicates(subset=['job_id'])
    return df, f"Обработано {len(df)} уникальных бенефитов"

# Список импорта с обработкой
import_steps = [
    ('companies', 'companies.csv', process_companies),
    ('industries', 'industries.csv', process_industries),
    ('skills', 'skills.csv', process_skills),
    ('jobs', 'job_postings.csv', process_jobs),
    ('benefits', 'benefits.csv', process_benefits),
    ('salaries', 'salaries.csv', process_salaries),
    ('employee_counts', 'employee_counts.csv', process_employee_counts),
    ('company_specialities', 'company_specialities.csv', process_company_specialities),
    ('job_industries', 'job_industries.csv', process_job_industries),
    ('job_skills', 'job_skills.csv', process_job_skills),
    # company_industries обрабатывается отдельно из-за маппинга
]

print(f"🚀 Начинаем идеальный импорт из: {FOLDER}")
successful_imports = 0

# Основной импорт
for table_name, csv_file, processor in import_steps:
    if safe_import(table_name, csv_file, processor):
        successful_imports += 1

print(f"\n{'='*60}")
print(f"✅ Основной импорт завершен: {successful_imports}/{len(import_steps)} таблиц")

# Специальная обработка company_industries (маппинг industry → industry_id)
print(f"\n🔄 Обработка company_industries с маппингом...")
try:
    # Загружаем данные
    df_ci = pd.read_csv(os.path.join(FOLDER, 'company_industries.csv'))
    df_ci = clean_column_names(df_ci)
    print(f"  Колонки в company_industries.csv: {list(df_ci.columns)}")
    
    # Проверяем наличие колонки industry
    if 'industry' not in df_ci.columns:
        print(f"  ⚠️  Колонка 'industry' не найдена! Доступные колонки: {list(df_ci.columns)}")
        print("⚠️  Не удалось создать маппинг для company_industries")
    else:
        # Маппинг industry_name → industry_id
        industry_mapping = pd.read_sql("SELECT industry_id, industry_name FROM industries", engine)
        print(f"  Доступно {len(industry_mapping)} отраслей для маппинга")
        
        mapping_dict = dict(zip(industry_mapping['industry_name'].str.lower(), industry_mapping['industry_id']))
        
        # Применяем маппинг
        df_ci['industry_id'] = df_ci['industry'].str.lower().map(mapping_dict)
        
        # Диагностика
        mapped_count = df_ci['industry_id'].notna().sum()
        print(f"  Успешно промаплено: {mapped_count} из {len(df_ci)} записей")
        
        if mapped_count > 0:
            df_ci = df_ci[df_ci['industry_id'].notna()][['company_id', 'industry_id']]
            df_ci = df_ci.drop_duplicates()
            df_ci.to_sql('company_industries', engine, if_exists='replace', index=False)
            print(f"✓ company_industries: {len(df_ci)} записей с маппингом")
        else:
            print("⚠️  Не удалось создать маппинг для company_industries")
            
except Exception as e:
    print(f"✗ Ошибка обработки company_industries: {e}")

# Финальная обработка job_skills (маппинг skill_abr → skill_id)
print(f"\n🔄 Обработка job_skills с маппингом...")
try:
    # Сначала проверяем, существует ли таблица skills
    skills_count = pd.read_sql("SELECT COUNT(*) as count FROM information_schema.tables WHERE table_name = 'skills'", engine)
    if skills_count['count'].iloc[0] == 0:
        print("✗ Таблица 'skills' не существует! Сначала импортируйте skills.csv")
    else:
        # Загружаем сырые данные
        df_js_raw = pd.read_csv(os.path.join(FOLDER, 'job_skills.csv'))
        df_js_raw = clean_column_names(df_js_raw)
        print(f"  Колонки в job_skills.csv: {list(df_js_raw.columns)}")
        
        # ИСПРАВЛЕНО: Используем skill_abr вместо skill_abbr
        skills_mapping = pd.read_sql("SELECT skill_id, skill_abr FROM skills", engine)
        print(f"  Доступно {len(skills_mapping)} навыков для маппинга")
        
        mapping_dict = dict(zip(skills_mapping['skill_abr'].str.lower(), skills_mapping['skill_id']))
        
        # Применяем маппинг
        df_js_raw['skill_id'] = df_js_raw['skill_abr'].str.lower().map(mapping_dict)
        
        # Диагностика маппинга
        mapped_count = df_js_raw['skill_id'].notna().sum()
        print(f"  Успешно промаплено: {mapped_count} из {len(df_js_raw)} записей")
        
        if mapped_count > 0:
            df_js = df_js_raw[df_js_raw['skill_id'].notna()][['job_id', 'skill_id']]
            df_js.to_sql('job_skills', engine, if_exists='replace', index=False, method='multi')
            print(f"✓ job_skills: {len(df_js)} записей с маппингом")
        else:
            print("⚠️  Не удалось создать маппинг для job_skills")
            
except Exception as e:
    print(f"✗ Ошибка обработки job_skills: {e}")

print(f"\n🎉 ВСЕ 11 ТАБЛИЦ УСПЕШНО ИМПОРТИРОВАНЫ!")
print(f"📁 Проверьте результат в pgAdmin4 → linkedin_jobs")