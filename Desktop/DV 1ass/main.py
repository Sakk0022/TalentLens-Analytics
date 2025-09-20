

import pandas as pd
from sqlalchemy import create_engine, text
import os
import numpy as np
from datetime import datetime
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path

# Настройки
DATABASE_URL = "postgresql+psycopg2://postgres:password@localhost:5432/linkedin_jobs"
PROJECT_ROOT = Path(__file__).parent  # Корень проекта
RESULTS_DIR = PROJECT_ROOT / "results"  # 📊 Папка для CSV
CHARTS_DIR = PROJECT_ROOT / "charts"    # 🖼️ Папка для графиков

# Создаем папки если их нет
RESULTS_DIR.mkdir(exist_ok=True)
CHARTS_DIR.mkdir(exist_ok=True)

class LinkedInJobsAnalyzer:
    def __init__(self, database_url):
        self.engine = create_engine(database_url)
        self.setup_logging()
    
    def setup_logging(self):
        """Настройка логирования"""
        print(f"🚀 LinkedIn Jobs Analytics - CareerFlow Platform")
        print(f"📅 Анализ запущен: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"💾 Подключение к БД: {DATABASE_URL.split('@')[1].split('/')[0]}")
        print(f"📁 Результаты CSV: {RESULTS_DIR.absolute()}")
        print(f"🖼️  Графики PNG: {CHARTS_DIR.absolute()}")
        print("-" * 80)
    
    def safe_filename(self, name):
        """Создает безопасное имя файла"""
        # Удаляем недопустимые символы
        safe_name = "".join(c for c in name if c.isalnum() or c in (' ', '-', '_')).rstrip()
        # Заменяем пробелы на подчеркивания
        safe_name = safe_name.replace(' ', '_').replace(':', '').replace('/', '_')
        # Ограничиваем длину
        return safe_name[:50]
    
    def execute_query(self, query_name, sql_query, save_to_csv=False):
        """Выполняет SQL-запрос и выводит результаты"""
        try:
            print(f"\n{'='*80}")
            print(f"📊 ЗАПРОС: {query_name}")
            print(f"{'='*80}")
            
            # Выполняем запрос
            df = pd.read_sql_query(text(sql_query), self.engine)
            
            # Выводим информацию о результатах
            print(f"📈 Результатов: {len(df):,}")
            print(f"📋 Столбцов: {len(df.columns)}")
            if len(df) > 0:
                print(f"🔢 Диапазон значений: {df.iloc[:, -1].min()} - {df.iloc[:, -1].max()}")
            
            print("\n📊 ПЕРВЫЕ 5 СТРОК:")
            print(df.head().to_string(index=False))
            
            # Сохраняем в CSV если нужно
            if save_to_csv and len(df) > 0:
                safe_name = self.safe_filename(query_name)
                filename = f"{safe_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
                filepath = RESULTS_DIR / filename
                df.to_csv(filepath, index=False)
                print(f"💾 CSV сохранен: {filepath.relative_to(PROJECT_ROOT)}")
            
            # Создаем график если возможно
            if len(df) > 0:
                self.create_chart(df, query_name, save_to_csv)
            
            return df
            
        except Exception as e:
            print(f"❌ Ошибка выполнения запроса '{query_name}': {e}")
            import traceback
            traceback.print_exc()
            return pd.DataFrame()
    
    def create_chart(self, df, query_name, save_to_csv):
        """Создает график для визуализации и сохраняет в charts/"""
        try:
            if len(df) == 0:
                print("⚠️  Нет данных для графика")
                return
            
            # Настройка стиля
            plt.style.use('default')
            sns.set_palette("husl")
            fig, ax = plt.subplots(figsize=(12, 8))
            
            safe_name = self.safe_filename(query_name)
            chart_title = f"Анализ: {query_name}"
            
            # Определяем тип графика на основе данных
            if 'job_count' in df.columns or 'total_jobs' in df.columns:
                # Горизонтальная столбчатая диаграмма для счетчиков
                metric_col = next((col for col in ['job_count', 'total_jobs', 'unique_jobs'] if col in df.columns), None)
                if metric_col:
                    top_n = min(15, len(df))
                    y_pos = range(top_n)
                    values = df.head(top_n)[metric_col].values
                    
                    bars = ax.barh(y_pos, values, color=sns.color_palette("husl", top_n))
                    ax.set_yticks(y_pos)
                    ax.set_yticklabels(df.head(top_n).iloc[:, 0].astype(str), fontsize=10)
                    ax.set_xlabel('Количество вакансий', fontsize=12)
                    ax.set_title(chart_title, fontsize=14, fontweight='bold')
                    
                    # Добавляем значения на полосы
                    for i, (bar, v) in enumerate(zip(bars, values)):
                        ax.text(v + max(values)*0.01, bar.get_y() + bar.get_height()/2, 
                               f'{v:,}', ha='left', va='center', fontsize=9)
                    
                    ax.invert_yaxis()
            
            elif 'avg_salary' in df.columns or 'med_salary' in df.columns:
                # Столбчатая диаграмма для зарплат
                salary_col = next((col for col in ['avg_salary', 'med_salary'] if col in df.columns), None)
                if salary_col:
                    top_n = min(12, len(df))
                    x_pos = range(top_n)
                    values = df.head(top_n)[salary_col].values
                    labels = df.head(top_n).iloc[:, 0].astype(str)
                    
                    bars = ax.bar(x_pos, values, color=sns.color_palette("viridis", top_n))
                    ax.set_xticks(x_pos)
                    ax.set_xticklabels(labels, rotation=45, ha='right', fontsize=9)
                    ax.set_ylabel('Средняя зарплата ($)', fontsize=12)
                    ax.set_title(chart_title, fontsize=14, fontweight='bold')
                    
                    # Добавляем значения
                    for i, (bar, v) in enumerate(zip(bars, values)):
                        ax.text(bar.get_x() + bar.get_width()/2, v + max(values)*0.02, 
                               f'${v:,.0f}', ha='center', va='bottom', fontsize=10)
            
            elif 'remote_pct' in df.columns or any('percentage' in col.lower() for col in df.columns):
                # Круговая диаграмма для процентов
                pct_col = next((col for col in df.columns if 'pct' in col.lower() or 'percentage' in col.lower()), None)
                if pct_col and len(df) <= 10:
                    labels = df.iloc[:, 0].astype(str)[:8]  # Максимум 8 секторов
                    sizes = df[pct_col].head(8).values
                    colors = sns.color_palette("pastel", len(labels))
                    
                    wedges, texts, autotexts = ax.pie(sizes, labels=labels, autopct='%1.1f%%', 
                                                    colors=colors, startangle=90)
                    ax.set_title(chart_title, fontsize=14, fontweight='bold')
            
            elif len(df) > 1 and df.select_dtypes(include=[np.number]).shape[1] > 0:
                # Линейный график для числовых данных
                numeric_cols = df.select_dtypes(include=[np.number]).columns
                if len(numeric_cols) > 0:
                    x_data = range(len(df))
                    y_data = df[numeric_cols[0]].values
                    
                    ax.plot(x_data, y_data, marker='o', linewidth=2, markersize=6)
                    ax.set_xticks(x_data[::max(1, len(df)//10)])
                    ax.set_xticklabels(df.iloc[::max(1, len(df)//10), 0].astype(str), 
                                     rotation=45, ha='right')
                    ax.set_ylabel(numeric_cols[0], fontsize=12)
                    ax.set_title(chart_title, fontsize=14, fontweight='bold')
                    ax.grid(True, alpha=0.3)
            
            else:
                print("⚠️  Тип данных не поддерживается для автоматической визуализации")
                plt.close(fig)
                return
            
            # Стилизация
            ax.grid(True, alpha=0.3, linestyle='--')
            plt.tight_layout()
            
            # Сохраняем график
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            chart_filename = f"{safe_name}_{timestamp}.png"
            chart_path = CHARTS_DIR / chart_filename
            
            plt.savefig(chart_path, dpi=300, bbox_inches='tight', 
                       facecolor='white', edgecolor='none')
            print(f"🖼️  PNG сохранен: {chart_path.relative_to(PROJECT_ROOT)}")
            
            # Показываем превью (опционально)
            if save_to_csv:  # Показываем только если сохраняем CSV
                plt.show()
            
            plt.close(fig)
            
        except Exception as e:
            print(f"⚠️  Не удалось создать график для '{query_name}': {e}")
            plt.close('all')
    
    def run_full_analysis(self):
        """Запускает полный анализ с 8 ключевыми запросами"""
        print("\n🎯 НАЧИНАЕМ ПОЛНЫЙ АНАЛИЗ РЫНКА ТРУДА")
        print("=" * 80)
        
        # Ключевые запросы для анализа
        key_queries = [
            {
                "name": "ТОП-10 НАВЫКОВ 2025",
                "sql": """
                SELECT 
                    s.skill_name as skill,
                    s.skill_abr,
                    COUNT(DISTINCT js.job_id)::INTEGER as job_count,
                    ROUND(AVG(j.applies * 1.0 / NULLIF(j.views, 0))::NUMERIC, 4) as apply_ratio
                FROM job_skills js
                JOIN skills s ON js.skill_id = s.skill_id
                JOIN jobs j ON js.job_id = j.job_id
                WHERE j.views > 0
                GROUP BY s.skill_id, s.skill_name, s.skill_abr
                ORDER BY job_count DESC
                LIMIT 10
                """,
                "save_csv": True
            },
            {
                "name": "ЗАРПЛАТЫ ПО ОТРАСЛЯМ",
                "sql": """
                SELECT 
                    i.industry_name as industry,
                    COUNT(DISTINCT ji.job_id) as job_count,
                    ROUND(AVG(sal.med_salary)::NUMERIC, 0) as avg_salary,
                    ROUND(MIN(sal.med_salary)::NUMERIC, 0) as min_salary,
                    ROUND(MAX(sal.med_salary)::NUMERIC, 0) as max_salary
                FROM job_industries ji
                JOIN industries i ON ji.industry_id = i.industry_id
                JOIN jobs j ON ji.job_id = j.job_id
                JOIN salaries sal ON j.job_id = sal.job_id
                WHERE sal.med_salary IS NOT NULL AND sal.med_salary > 0
                GROUP BY i.industry_id, i.industry_name
                HAVING COUNT(DISTINCT ji.job_id) > 10
                ORDER BY avg_salary DESC
                LIMIT 15
                """,
                "save_csv": True
            },
            {
                "name": "ТОП-20 АКТИВНЫХ КОМПАНИЙ",
                "sql": """
                SELECT 
                    c.name as company,
                    c.city,
                    c.country,
                    COUNT(j.job_id) as total_jobs,
                    ROUND(AVG(sal.med_salary)::NUMERIC, 0) as avg_salary,
                    SUM(j.applies) as total_applies,
                    ROUND(AVG(j.views)::NUMERIC, 0) as avg_views
                FROM companies c
                JOIN jobs j ON c.company_id = j.company_id
                LEFT JOIN salaries sal ON j.job_id = sal.job_id
                GROUP BY c.company_id, c.name, c.city, c.country
                HAVING COUNT(j.job_id) > 20
                ORDER BY total_jobs DESC
                LIMIT 20
                """,
                "save_csv": True
            },
            {
                "name": "УДАЛЁННАЯ РАБОТА ПО ОТРАСЛЯМ",
                "sql": """
                SELECT 
                    i.industry_name as industry,
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
                LIMIT 15
                """,
                "save_csv": True
            },
            {
                "name": "ЗАРПЛАТЫ ПО УРОВНЮ ОПЫТА",
                "sql": """
                SELECT 
                    j.formatted_experience_level as experience_level,
                    COUNT(j.job_id) as job_count,
                    ROUND(AVG(sal.med_salary)::NUMERIC, 0) as avg_salary,
                    ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY sal.med_salary)::NUMERIC, 0) as q25_salary,
                    ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY sal.med_salary)::NUMERIC, 0) as q75_salary
                FROM jobs j
                JOIN salaries sal ON j.job_id = sal.job_id
                WHERE j.formatted_experience_level IS NOT NULL
                  AND sal.med_salary IS NOT NULL 
                  AND sal.med_salary > 0
                GROUP BY j.formatted_experience_level
                ORDER BY 
                    CASE 
                        WHEN j.formatted_experience_level ILIKE '%internship%' THEN 1
                        WHEN j.formatted_experience_level ILIKE '%entry%' THEN 2
                        WHEN j.formatted_experience_level ILIKE '%associate%' THEN 3
                        WHEN j.formatted_experience_level ILIKE '%mid%' THEN 4
                        WHEN j.formatted_experience_level ILIKE '%senior%' THEN 5
                        ELSE 6 
                    END
                """,
                "save_csv": True
            },
            {
                "name": "РЕГИОНАЛЬНЫЙ АНАЛИЗ ЗАРПЛАТ",
                "sql": """
                SELECT 
                    CASE 
                        WHEN j.location ILIKE '%, %' THEN 
                            SUBSTRING(j.location, 1, POSITION(',' IN j.location) - 1)
                        ELSE j.location 
                    END as region,
                    COUNT(j.job_id) as job_count,
                    ROUND(AVG(sal.med_salary)::NUMERIC, 0) as avg_salary,
                    MIN(sal.med_salary)::INTEGER as min_salary,
                    MAX(sal.med_salary)::INTEGER as max_salary
                FROM jobs j
                JOIN salaries sal ON j.job_id = sal.job_id
                WHERE sal.med_salary IS NOT NULL AND sal.med_salary > 0
                GROUP BY region
                HAVING COUNT(j.job_id) > 30
                ORDER BY avg_salary DESC
                LIMIT 20
                """,
                "save_csv": True
            },
           
            {
                "name": "ЭФФЕКТИВНОСТЬ РЕКРУТИНГА",
                "sql": """
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
                LIMIT 15
                """,
                "save_csv": True
            }
        ]
        
        # Выполняем все запросы
        results = {}
        successful_queries = 0
        
        for i, query in enumerate(key_queries, 1):
            print(f"\n⏳ Выполняется запрос {i}/{len(key_queries)}...")
            df = self.execute_query(query["name"], query["sql"], query["save_csv"])
            if len(df) > 0:
                results[query["name"]] = df
                successful_queries += 1
        
        # Финальная статистика
        self.print_summary_stats(results, successful_queries)
        
        return results
    
    def print_summary_stats(self, results, successful_queries):
        """Выводит итоговую статистику анализа"""
        print(f"\n{'='*80}")
        print("📊 ИТОГОВАЯ СТАТИСТИКА АНАЛИЗА")
        print(f"{'='*80}")
        
        try:
            # Базовая статистика БД
            stats = pd.read_sql_query("""
                SELECT 
                    (SELECT COUNT(*) FROM companies) as total_companies,
                    (SELECT COUNT(*) FROM jobs) as total_jobs,
                    (SELECT COUNT(*) FROM skills) as total_skills,
                    (SELECT COUNT(*) FROM industries) as total_industries,
                    (SELECT ROUND(AVG(med_salary)::NUMERIC, 0) FROM salaries WHERE med_salary > 0) as avg_salary_all
            """, self.engine).iloc[0]
            
            print(f"🏢 Всего компаний: {stats['total_companies']:,}")
            print(f"💼 Всего вакансий: {stats['total_jobs']:,}")
            print(f"🎯 Уникальных навыков: {stats['total_skills']:,}")
            print(f"🏭 Отраслей: {stats['total_industries']:,}")
            print(f"💰 Средняя зарплата по всем вакансиям: ${stats['avg_salary_all']:,.0f}")
            
            # Статистика файлов
            csv_files = list(RESULTS_DIR.glob("*.csv"))
            png_files = list(CHARTS_DIR.glob("*.png"))
            print(f"\n📁 Создано файлов:")
            print(f"   📊 CSV отчетов: {len(csv_files)}")
            print(f"   🖼️  PNG графиков: {len(png_files)}")
            
            # Ключевые инсайты из результатов
            print(f"\n⭐ КЛЮЧЕВЫЕ ИНСАЙТЫ:")
            if 'ТОП-10 НАВЫКОВ 2025' in results and len(results['ТОП-10 НАВЫКОВ 2025']) > 0:
                top_skill_row = results['ТОП-10 НАВЫКОВ 2025'].iloc[0]
                print(f"   🎯 Самый востребованный навык: '{top_skill_row['skill']}' ({top_skill_row['job_count']:,} вакансий)")
            
            if 'ЗАРПЛАТЫ ПО ОТРАСЛЯМ' in results and len(results['ЗАРПЛАТЫ ПО ОТРАСЛЯМ']) > 0:
                top_salary_row = results['ЗАРПЛАТЫ ПО ОТРАСЛЯМ'].iloc[0]
                print(f"   💰 Высшая зарплата: ${top_salary_row['avg_salary']:,.0f} в '{top_salary_row['industry']}'")
            
            if 'ТОП-20 АКТИВНЫХ КОМПАНИЙ' in results and len(results['ТОП-20 АКТИВНЫХ КОМПАНИЙ']) > 0:
                top_company_row = results['ТОП-20 АКТИВНЫХ КОМПАНИЙ'].iloc[0]
                print(f"   🏢 Самый активный работодатель: '{top_company_row['company']}' ({top_company_row['total_jobs']:,} вакансий)")
            
            print(f"\n✅ Успешно выполнено запросов: {successful_queries}/{len(results)}")
            print(f"📂 Проверьте результаты:")
            print(f"   📊 {RESULTS_DIR.relative_to(PROJECT_ROOT)}/ - CSV файлы")
            print(f"   🖼️  {CHARTS_DIR.relative_to(PROJECT_ROOT)}/ - PNG графики")
            
        except Exception as e:
            print(f"⚠️  Не удалось получить статистику: {e}")
    
    def test_connection(self):
        """Тестирует подключение к базе данных"""
        try:
            # Простой тест подключения
            df = pd.read_sql_query("SELECT COUNT(*) as total_jobs FROM jobs", self.engine)
            total = df['total_jobs'].iloc[0]
            print(f"✅ Подключение успешно! База данных содержит {total:,} вакансий")
            
            # Проверка папок
            print(f"📁 Папки результатов:")
            print(f"   📊 CSV: {RESULTS_DIR.absolute()}")
            print(f"   🖼️  PNG: {CHARTS_DIR.absolute()}")
            
            return True
        except Exception as e:
            print(f"❌ Ошибка подключения: {e}")
            return False
    
    def cleanup_old_files(self, days=7):
        """Очищает старые файлы (старше N дней)"""
        from datetime import datetime, timedelta
        
        cutoff_date = datetime.now() - timedelta(days=days)
        deleted_csv = 0
        deleted_png = 0
        
        # Очистка CSV
        for file in RESULTS_DIR.glob("*.csv"):
            if file.stat().st_mtime < cutoff_date.timestamp():
                try:
                    file.unlink()
                    deleted_csv += 1
                except:
                    pass
        
        # Очистка PNG
        for file in CHARTS_DIR.glob("*.png"):
            if file.stat().st_mtime < cutoff_date.timestamp():
                try:
                    file.unlink()
                    deleted_png += 1
                except:
                    pass
        
        if deleted_csv + deleted_png > 0:
            print(f"🧹 Очищено {deleted_csv} CSV и {deleted_png} PNG файлов (старше {days} дней)")

def main():
    """Главная функция - запуск аналитики"""
    print("🏁 CareerFlow Analytics - Анализ рынка труда LinkedIn")
    print("=" * 80)
    
    # Инициализация анализатора
    analyzer = LinkedInJobsAnalyzer(DATABASE_URL)
    
    # Тест подключения
    if not analyzer.test_connection():
        print("\n❌ Не удалось подключиться к базе данных. Проверьте настройки.")
        print("💡 Убедитесь, что:")
        print("   • PostgreSQL запущен")
        print("   • База 'linkedin_jobs' существует") 
        print("   • Пароль '355812' верный")
        return
    
    # Очистка старых файлов (опционально)
    # analyzer.cleanup_old_files(days=7)
    
    # Запуск полного анализа
    print("\n" + "="*80)
    print("🎯 ЗАПУСК ПОЛНОГО АНАЛИЗА (8 запросов)")
    print("="*80)
    
    try:
        results = analyzer.run_full_analysis()
        
        print(f"\n🎉 АНАЛИЗ ЗАВЕРШЁН УСПЕШНО!")
        print(f"📊 Всего обработано запросов: {len(results)}")
        print(f"\n📁 РЕЗУЛЬТАТЫ СОХРАНЕНЫ:")
        print(f"   📊 CSV файлы: {RESULTS_DIR}")
        print(f"   🖼️  PNG графики: {CHARTS_DIR}")
        
        # Предложение открыть папки
        if os.name == 'posix':  # macOS/Linux
            print(f"\n💡 Открыть папки:")
            print(f"   open {RESULTS_DIR}")
            print(f"   open {CHARTS_DIR}")
        elif os.name == 'nt':  # Windows
            print(f"\n💡 Открыть папки:")
            print(f"   explorer {RESULTS_DIR}")
            print(f"   explorer {CHARTS_DIR}")
            
    except KeyboardInterrupt:
        print("\n⏹️  Анализ прерван пользователем")
    except Exception as e:
        print(f"\n❌ Критическая ошибка: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()