import logging
from datetime import date, timedelta

logger = logging.getLogger(__name__)


class JapaneseHolidayCalculator:
    def __init__(self):
        self._holiday_cache: dict[int, set[date]] = {}

    def is_holiday(self, target_date: date) -> bool:
        try:
            year = target_date.year

            if year in self._holiday_cache:
                return target_date in self._holiday_cache[year]

            holidays = self._calculate_holidays_for_year(year)
            self._holiday_cache[year] = holidays

            return target_date in holidays

        except Exception as e:
            logger.error(f"Error checking holiday status for {target_date}: {e}")
            return False

    def _calculate_holidays_for_year(self, year: int) -> set[date]:
        holidays: set[date] = set()

        try:
            # New Year's Day (元日)
            holidays.add(date(year, 1, 1))

            # Coming of Age Day (成人の日) - 2nd Monday in January
            holidays.add(self._get_nth_weekday(year, 1, 0, 2))

            # National Foundation Day (建国記念の日)
            holidays.add(date(year, 2, 11))

            # Emperor's Birthday (天皇誕生日)
            if year >= 2020:
                holidays.add(date(year, 2, 23))
            elif year >= 1989:
                holidays.add(date(year, 12, 23))
            else:
                holidays.add(date(year, 4, 29))

            # Vernal Equinox Day (春分の日)
            vernal_equinox = self._calculate_vernal_equinox(year)
            if vernal_equinox:
                holidays.add(vernal_equinox)

            # Showa Day (昭和の日)
            if year >= 2007:
                holidays.add(date(year, 4, 29))

            # Constitution Memorial Day (憲法記念日)
            holidays.add(date(year, 5, 3))

            # Midori no Hi (みどりの日)
            if year >= 2007:
                holidays.add(date(year, 5, 4))
            elif year >= 1989:
                holidays.add(date(year, 4, 29))

            # Children's Day (こどもの日)
            holidays.add(date(year, 5, 5))

            # Marine Day (海の日)
            if year >= 2021:
                if year == 2021:
                    holidays.add(date(year, 7, 22))
                else:
                    holidays.add(self._get_nth_weekday(year, 7, 0, 3))
            elif year >= 2003:
                holidays.add(self._get_nth_weekday(year, 7, 0, 3))
            elif year >= 1996:
                holidays.add(date(year, 7, 20))

            # Mountain Day (山の日)
            if year >= 2021:
                if year == 2021:
                    holidays.add(date(year, 8, 8))
                else:
                    holidays.add(date(year, 8, 11))
            elif year >= 2016:
                holidays.add(date(year, 8, 11))

            # Respect for the Aged Day (敬老の日) - 3rd Monday in September
            if year >= 2003:
                holidays.add(self._get_nth_weekday(year, 9, 0, 3))
            else:
                holidays.add(date(year, 9, 15))

            # Autumnal Equinox Day (秋分の日)
            autumnal_equinox = self._calculate_autumnal_equinox(year)
            if autumnal_equinox:
                holidays.add(autumnal_equinox)

            # Sports Day (スポーツの日)
            if year == 2021:
                holidays.add(date(year, 7, 23))
            elif year >= 2000:
                holidays.add(self._get_nth_weekday(year, 10, 0, 2))
            else:
                holidays.add(date(year, 10, 10))

            # Culture Day (文化の日)
            holidays.add(date(year, 11, 3))

            # Labor Thanksgiving Day (勤労感謝の日)
            holidays.add(date(year, 11, 23))

            holidays.update(self._calculate_substitution_holidays(holidays))
            holidays.update(self._calculate_bridge_holidays(holidays))

            return holidays

        except Exception as e:
            logger.error(f"Error calculating holidays for year {year}: {e}")
            return set()

    def _get_nth_weekday(self, year: int, month: int, weekday: int, n: int) -> date:
        first_day = date(year, month, 1)
        days_ahead = weekday - first_day.weekday()
        if days_ahead < 0:
            days_ahead += 7

        first_occurrence = first_day + timedelta(days=days_ahead)
        return first_occurrence + timedelta(weeks=n - 1)

    def _calculate_vernal_equinox(self, year: int) -> date:
        try:
            if year <= 1947:
                day = int(21.124 + 0.2422 * (year - 1851) - int((year - 1851) / 4))
            elif year <= 1979:
                day = int(21.851 + 0.2422 * (year - 1851) - int((year - 1851) / 4))
            elif year <= 2099:
                day = int(20.8431 + 0.242194 * (year - 1851) - int((year - 1851) / 4))
            elif year <= 2150:
                day = int(21.851 + 0.242194 * (year - 1851) - int((year - 1851) / 4))
            else:
                day = 20

            return date(year, 3, day)
        except Exception as e:
            logger.error(f"Error calculating vernal equinox for {year}: {e}")
            return date(year, 3, 20)

    def _calculate_autumnal_equinox(self, year: int) -> date:
        try:
            if year <= 1947:
                day = int(24.2488 + 0.2422 * (year - 1851) - int((year - 1851) / 4))
            elif year <= 1979:
                day = int(23.2488 + 0.2422 * (year - 1851) - int((year - 1851) / 4))
            elif year <= 2099:
                day = int(23.2488 + 0.242194 * (year - 1851) - int((year - 1851) / 4))
            elif year <= 2150:
                day = int(24.2488 + 0.242194 * (year - 1851) - int((year - 1851) / 4))
            else:
                day = 23

            return date(year, 9, day)
        except Exception as e:
            logger.error(f"Error calculating autumnal equinox for {year}: {e}")
            return date(year, 9, 23)

    def _calculate_substitution_holidays(self, holidays: set[date]) -> set[date]:
        substitution_holidays: set[date] = set()

        for holiday in holidays:
            if holiday.weekday() == 6:
                next_day = holiday + timedelta(days=1)
                while next_day in holidays or next_day in substitution_holidays:
                    next_day += timedelta(days=1)
                substitution_holidays.add(next_day)

        return substitution_holidays

    def _calculate_bridge_holidays(self, holidays: set[date]) -> set[date]:
        bridge_holidays: set[date] = set()
        sorted_holidays = sorted(holidays)

        for i in range(len(sorted_holidays) - 1):
            current_holiday = sorted_holidays[i]
            next_holiday = sorted_holidays[i + 1]

            diff = (next_holiday - current_holiday).days
            if diff == 2:
                bridge_day = current_holiday + timedelta(days=1)
                if bridge_day.weekday() < 5:
                    bridge_holidays.add(bridge_day)

        return bridge_holidays

    def get_holidays_for_year(self, year: int) -> set[date]:
        if year in self._holiday_cache:
            return self._holiday_cache[year].copy()

        holidays = self._calculate_holidays_for_year(year)
        self._holiday_cache[year] = holidays
        return holidays.copy()
