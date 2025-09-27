# TalentLens-Analytics

## Project Description
TalentLens-Analytics is a virtual company specializing in labor market analysis. The project conducts LinkedIn job analytics: importing data from CSV to PostgreSQL, analyzing skills, salaries, companies, and remote work, generating reports in CSV and graphs in PNG.

## How to launch a project
1. Install the dependencies: `pip install pandas sqlalchemy psycopg2 matplotlib seaborn`.
2. Configure PostgreSQL: create a linkedin_jobs database with the user postgres and the password password.
3. Download the LinkedIn CSV files to the folder `/Users/aleksandrsudro/Desktop/archive' (or specify your path in the code).
4. Run the script: `python main_script.py ` (where `main_script.py ` is your code file). This will import the data, perform the analysis, and save the results to `results/` and `charts/'.

## Tools and resources
- Python 3.x with libraries: pandas, sqlalchemy, matplotlib, seaborn.
- PostgreSQL for data storage.
- GitHub for the repository (public access).
- Data: CSV files of LinkedIn vacancies (companies.csv, jobs.csv, etc.).

The repository includes code, CSV examples (if applicable), and results/charts folders for output. Make sure that the repository is public.
<img width="754" height="531" alt="erd" src="https://github.com/user-attachments/assets/d60b95e7-3abb-4ee9-a650-30f647a619a6" />
