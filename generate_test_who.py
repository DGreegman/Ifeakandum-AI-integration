import pandas as pd
import random

# WHO data essence: Storing global/regional health indicators 
# (e.g., Life Expectancy, Mortality) to provide context for AI analysis results.

indicators = [
    "Life expectancy at birth (years)",
    "Maternal mortality ratio (per 100,000 live births)",
    "Infant mortality rate (per 1,000 live births)",
    "Prevalence of undernourishment (%)",
    "Current health expenditure (% of GDP)"
]

countries = ["Nigeria", "Ghana", "Kenya", "South Africa", "Egypt"]

data = {
    "Country": [random.choice(countries) for _ in range(100)],
    "Year": [random.randint(2015, 2023) for _ in range(100)],
    "Indicator": [random.choice(indicators) for _ in range(100)],
    "Value": [round(random.uniform(5.0, 95.0), 2) for _ in range(100)]
}

df = pd.DataFrame(data)
df.to_csv("who_test_100.csv", index=False)
print("✅ Successfully generated who_test_100.csv with 100 rows.")
