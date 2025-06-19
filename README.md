# authorsight-export 📦

[![npm version](https://badge.fury.io/js/authorsight-export.svg)](http://badge.fury.io/js/authorsight-export)
[![CI](https://github.com/lmammino/authorsight-export/actions/workflows/ci.yml/badge.svg)](https://github.com/lmammino/authorsight-export/actions/workflows/ci.yml)

A CLI tool to fetch and export book sales and revenue data from the Packt
AuthorSight portal in Hive-compatible format.

## Rationale 💡

Hi there, fellow Packt author! 👋

Chances are, if you’ve landed here, you’re looking for a way to make better use
of the data in the AuthorSight portal. Same here!

I’m [Luciano Mammino](https://loige.co), a software engineer and co-author of
[Node.js Design Patterns](https://nodejsdesignpatterns.com). (Shameless plug,
but it might be useful if you're looking to improve your Node.js game!)

As authors, we get access to Packt AuthorSight: a handy dashboard with our sales
and royalty data, but sometimes you just want that information in a more
flexible format. Maybe you want to run your own analysis, generate custom
reports, integrate it with other tools, or just keep a tidy archive.

That’s exactly why I built this little tool. If you're looking to export your
Packt sales data quickly and cleanly, you're in the right place.

Hope it helps and happy hacking! 🚀

## Features ✨

- Fetch Kindle and Print sales data (Amazon, Direct, Other)
- Supports multiple data types:
  - `amazon_units_daily`
  - `direct_units_daily`
  - `revenue_monthly`
  - `revenue_quarterly`
  - `revenue_annual`
- Exports data in a directory structure by book and year (hive-compatible for
  supporting tools like Apache Hive, DuckDB, AWS Athena, etc.)
- Progress bars, retry and robust error handling

## Installation 🛠️

You can use this tool directly with `npx` (recommended):

```sh
npx authorsight-export --session <cookie> [options]
```

Or, install globally:

```sh
npm install -g authorsight-export
```

Or, clone the repository and install dependencies:

```sh
git clone https://github.com/yourusername/authorsight-export.git
cd authorsight-export
npm install
```

## Usage 🚀

### With npx (recommended)

```sh
export AUTHORSIGHT_SESSION=<cookie>
```

> [!IMPORTANT]\
> Make sure to replace `<cookie>` with your actual Packt `authorsight_session`
> and that the value is URL-decoded (e.g., no `%20` for spaces). You can find
> this cookie in your browser's developer tools under the "Application" tab
> after logging in on the
> [Packt AuthorSight portal](https://authors.packt.com/).

Then run:

```sh
npx authorsight-export [options]
```

> [!CAUTION]\
> You can also pass your session cookie inline using the `--session` option.
> This is discouraged, and it is instead recommended setting your session cookie
> using the `AUTHORSIGHT_SESSION` environment variable. This is more secure and
> avoids leaking sensitive information in shell history.

### Options ⚙️

- `-s, --session <cookie>`: Packt `authorsight_session` cookie (**discouraged**;
  use the `AUTHORSIGHT_SESSION` environment variable instead)
- `-o, --output <directory>`: Output directory (default: `.`)
- `-b, --books <bookIds>`: Comma-separated list of book IDs (default: all books)
- `-t, --types <types>`: Comma-separated list of data types to fetch (default:
  all)
- `-V, --version`: Show CLI version
- `-h, --help`: Show help message

### Example 💡

```sh
AUTHORSIGHT_SESSION=YOUR_SESSION_COOKIE npx authorsight-export -b B05259,C09167 -t revenue_monthly,revenue_annual -o ./output
```

## Data Types 📊

| Type               | Endpoint     | Description        |
| ------------------ | ------------ | ------------------ |
| amazon_units_daily | amazon-daily | Daily Amazon units |
| direct_units_daily | direct-daily | Daily Direct units |
| revenue_monthly    | monthly      | Monthly revenue    |
| revenue_quarterly  | quarterly    | Quarterly revenue  |
| revenue_annual     | annual       | Annual revenue     |

## DuckDB query example 🦆

Just to provide an example of how you can query the exported data using
[DuckDB](https://duckdb.org/), the following SQL query sums the total print and
digital units across all books and data types (amazon and direct):

```sql
SELECT SUM(print_units + digital_units) FROM (
  SELECT book, date, month, year, print_units, kindle_units AS digital_units FROM read_csv('amazon_units_daily/**/*.csv')
  UNION
  SELECT book, date, month, year, print_units, digital_units FROM read_csv('direct_units_daily/**/*.csv')
)
```

## Contributing 🤝

Everyone is very welcome to contribute to this project. You can contribute just
by submitting bugs or suggesting improvements by
[opening an issue on GitHub](https://github.com/lmammino/authorsight-export/issues).
PRs are also very welcome.

## License 📄

Licensed under [MIT License](LICENSE). © Luciano Mammino.
