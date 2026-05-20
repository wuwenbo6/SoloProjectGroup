<?php
namespace Utils;

class BcMath
{
    const SCALE = 10;

    public static function add($a, $b, int $scale = null): string
    {
        $scale = $scale ?? self::SCALE;
        return bcadd((string)$a, (string)$b, $scale);
    }

    public static function sub($a, $b, int $scale = null): string
    {
        $scale = $scale ?? self::SCALE;
        return bcsub((string)$a, (string)$b, $scale);
    }

    public static function mul($a, $b, int $scale = null): string
    {
        $scale = $scale ?? self::SCALE;
        return bcmul((string)$a, (string)$b, $scale);
    }

    public static function div($a, $b, int $scale = null): string
    {
        $scale = $scale ?? self::SCALE;
        if ((float)$b == 0) {
            return '0';
        }
        return bcdiv((string)$a, (string)$b, $scale);
    }

    public static function comp($a, $b, int $scale = null): int
    {
        $scale = $scale ?? self::SCALE;
        return bccomp((string)$a, (string)$b, $scale);
    }

    public static function round($value, int $precision = 2): float
    {
        return round((float)$value, $precision);
    }

    public static function toFloat($value): float
    {
        return (float)$value;
    }

    public static function percentRate($actual, $standard, int $precision = 2): float
    {
        if (self::comp($standard, 0) <= 0) {
            return 0;
        }
        $result = self::mul(self::div($actual, $standard), 100);
        return self::round($result, $precision);
    }
}