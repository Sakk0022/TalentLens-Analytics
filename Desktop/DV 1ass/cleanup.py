
import os
from pathlib import Path
from datetime import datetime, timedelta
import argparse

def cleanup_old_files(results_dir, charts_dir, days=7):
    """Удаляет файлы старше N дней"""
    cutoff_date = datetime.now() - timedelta(days=days)
    deleted = {'csv': 0, 'png': 0}
    
    # Очистка CSV
    results_path = Path(results_dir)
    for file in results_path.glob("*.csv"):
        if file.stat().st_mtime < cutoff_date.timestamp():
            file.unlink()
            deleted['csv'] += 1
            print(f"🗑️  Удален CSV: {file.name}")
    
    # Очистка PNG
    charts_path = Path(charts_dir)
    for file in charts_path.glob("*.png"):
        if file.stat().st_mtime < cutoff_date.timestamp():
            file.unlink()
            deleted['png'] += 1
            print(f"🗑️  Удален PNG: {file.name}")
    
    print(f"\n✅ Очистка завершена!")
    print(f"   📊 Удалено CSV файлов: {deleted['csv']}")
    print(f"   🖼️  Удалено PNG файлов: {deleted['png']}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Очистка старых файлов результатов")
    parser.add_argument("--days", type=int, default=7, help="Удалять файлы старше N дней")
    parser.add_argument("--results-dir", default="results", help="Папка с CSV")
    parser.add_argument("--charts-dir", default="charts", help="Папка с PNG")
    
    args = parser.parse_args()
    
    cleanup_old_files(args.results_dir, args.charts_dir, args.days)