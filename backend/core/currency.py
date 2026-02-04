"""
Currency conversion and formatting utilities for multi-currency support.
Provides functions for converting between base (USD) and display currencies.
"""

from decimal import Decimal
from typing import Union
from enum import Enum


class SupportedCurrency(str, Enum):
    """Supported currencies in the system"""
    USD = "USD"
    INR = "INR"
    EUR = "EUR"
    GBP = "GBP"
    JPY = "JPY"


class CurrencyConfig:
    """Configuration for currency display and formatting"""
    
    CURRENCY_SYMBOLS = {
        "USD": "$",
        "INR": "₹",
        "EUR": "€",
        "GBP": "£",
        "JPY": "¥"
    }
    
    LOCALE_MAP = {
        "USD": "en-US",
        "INR": "en-IN",
        "EUR": "de-DE",
        "GBP": "en-GB",
        "JPY": "ja-JP"
    }
    
    # Decimal places for each currency
    DECIMAL_PLACES = {
        "USD": 2,
        "INR": 2,
        "EUR": 2,
        "GBP": 2,
        "JPY": 0,  # JPY doesn't use decimals
    }


def convert_to_display_currency(
    base_value: Union[int, float, Decimal],
    fx_rate: Union[int, float, Decimal]
) -> Decimal:
    """
    Convert a base value (in USD) to display currency using the FX rate.
    
    Args:
        base_value: The value in base currency (typically USD)
        fx_rate: The exchange rate (e.g., 1 USD = 83.12 INR means fx_rate=83.12)
    
    Returns:
        The converted value as Decimal with appropriate precision
    
    Example:
        >>> convert_to_display_currency(100, Decimal('83.12'))
        Decimal('8312.00')
    """
    base_decimal = Decimal(str(base_value))
    rate_decimal = Decimal(str(fx_rate))
    
    if rate_decimal <= 0:
        raise ValueError("Exchange rate must be greater than 0")
    
    return (base_decimal * rate_decimal).quantize(Decimal('0.01'))


def convert_from_display_currency(
    display_value: Union[int, float, Decimal],
    fx_rate: Union[int, float, Decimal]
) -> Decimal:
    """
    Convert a display currency value back to base currency (USD).
    
    Args:
        display_value: The value in display currency
        fx_rate: The exchange rate
    
    Returns:
        The value in base currency as Decimal
    
    Example:
        >>> convert_from_display_currency(8312, Decimal('83.12'))
        Decimal('100.00')
    """
    display_decimal = Decimal(str(display_value))
    rate_decimal = Decimal(str(fx_rate))
    
    if rate_decimal <= 0:
        raise ValueError("Exchange rate must be greater than 0")
    
    return (display_decimal / rate_decimal).quantize(Decimal('0.01'))


def format_currency_value(
    value: Union[int, float, Decimal],
    currency_code: str,
    include_symbol: bool = True
) -> str:
    """
    Format a currency value for display.
    
    Args:
        value: The numeric value
        currency_code: Currency code (e.g., 'USD', 'INR')
        include_symbol: Whether to include currency symbol
    
    Returns:
        Formatted currency string
    
    Example:
        >>> format_currency_value(8312, 'INR')
        '₹8,312.00'
    """
    if currency_code not in SupportedCurrency.__members__:
        raise ValueError(f"Unsupported currency: {currency_code}")
    
    decimal_value = Decimal(str(value))
    decimal_places = CurrencyConfig.DECIMAL_PLACES.get(currency_code, 2)
    
    # Format with appropriate decimal places
    format_string = f"{{:,.{decimal_places}f}}"
    formatted_number = format_string.format(decimal_value)
    
    if include_symbol:
        symbol = CurrencyConfig.CURRENCY_SYMBOLS.get(currency_code, currency_code)
        return f"{symbol}{formatted_number}"
    
    return formatted_number


def get_currency_info(currency_code: str) -> dict:
    """
    Get currency information (symbol, locale, decimal places).
    
    Args:
        currency_code: Currency code
    
    Returns:
        Dictionary with currency information
    """
    if currency_code not in SupportedCurrency.__members__:
        raise ValueError(f"Unsupported currency: {currency_code}")
    
    return {
        "code": currency_code,
        "symbol": CurrencyConfig.CURRENCY_SYMBOLS[currency_code],
        "locale": CurrencyConfig.LOCALE_MAP[currency_code],
        "decimal_places": CurrencyConfig.DECIMAL_PLACES[currency_code]
    }


class TenantCurrencyContext:
    """
    Helper class to manage currency conversion for a tenant.
    Simplifies currency operations with tenant-specific rates.

    Backwards compatible: accepts either (display_currency, fx_rate) or (currency, conversion_rate).
    """
    
    def __init__(self, base_currency: str = "USD", display_currency: str = None, fx_rate: Decimal = None, currency: str = None, conversion_rate: Decimal = None):
        """
        Initialize currency context for a tenant.
        
        Args:
            base_currency: Base currency (typically USD)
            display_currency/currency: Currency to display values in
            fx_rate/conversion_rate: Exchange rate
        """
        self.base_currency = base_currency

        # Prefer explicit new fields if provided, otherwise use legacy names
        self.display_currency = currency or display_currency or "USD"
        rate = conversion_rate if conversion_rate is not None else fx_rate
        self.fx_rate = Decimal(str(rate or "1.0"))

        if self.fx_rate <= 0:
            raise ValueError("Exchange rate must be greater than 0")
    
    def convert_for_display(self, base_value: Union[int, float, Decimal]) -> Decimal:
        """Convert a base value to display currency."""
        return convert_to_display_currency(base_value, self.fx_rate)
    
    def convert_from_display(self, display_value: Union[int, float, Decimal]) -> Decimal:
        """Convert a display value back to base currency."""
        return convert_from_display_currency(display_value, self.fx_rate)
    
    def format_display_value(self, base_value: Union[int, float, Decimal], include_symbol: bool = True) -> str:
        """Format a value for display in the tenant's currency."""
        display_value = self.convert_for_display(base_value)
        return format_currency_value(display_value, self.display_currency, include_symbol)
    
    def to_dict(self) -> dict:
        """Get currency context as dictionary."""
        return {
            "base_currency": self.base_currency,
            "currency": self.display_currency,
            "conversion_rate": float(self.fx_rate),
            "currency_info": get_currency_info(self.display_currency)
        }
