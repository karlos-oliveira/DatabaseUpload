import path from 'path';
import fs from 'fs';
import csvParser from 'csv-parse';
import { getRepository, In, getCustomRepository } from 'typeorm';
import Transactions from '../models/Transaction';
import uploadConfig from '../config/upload';
import Categories from '../models/Category';
import TransactionsRepository from '../repositories/TransactionsRepository';

interface CSVTransaction {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category: string;
}

class ImportTransactionsService {
  async execute(filename: string): Promise<Transactions[]> {
    const categoriesRepository = getRepository(Categories);
    const transactionsRepository = getCustomRepository(TransactionsRepository);
    const csvFilePath = path.resolve(uploadConfig.directory, filename);

    const transactionReadStream = fs.createReadStream(csvFilePath);

    const parsers = csvParser({ from_line: 2 });

    const parseCSV = transactionReadStream.pipe(parsers);

    const transactions: CSVTransaction[] = [];
    const categories: string[] = [];

    parseCSV.on('data', async line => {
      const [title, type, value, category] = line.map((cell: string) =>
        cell.trim(),
      );

      if (!title || !type || !value) return;

      categories.push(category);
      transactions.push({ title, type, value, category });
    });

    await new Promise(resolve => parseCSV.on('end', resolve));

    const categoryExists = await categoriesRepository.find({
      where: { title: In(categories) },
    });

    const categoryTitles = categoryExists.map((cat: Categories) => cat.title);

    const addCategoryTitles = categories
      .filter(cat => !categoryTitles.includes(cat))
      .filter((value, index, self) => self.indexOf(value) === index);

    const newCategories = categoriesRepository.create(
      addCategoryTitles.map(title => ({ title })),
    );

    await categoriesRepository.save(newCategories);

    const finalCategories = [...newCategories, ...categoryExists];

    const createdTrasactions = transactionsRepository.create(
      transactions.map(trans => ({
        title: trans.title,
        type: trans.type,
        value: trans.value,
        category: finalCategories.find(
          category => category.title === trans.category,
        ),
      })),
    );

    await transactionsRepository.save(createdTrasactions);

    await fs.promises.unlink(csvFilePath);

    return createdTrasactions;
  }
}

export default ImportTransactionsService;
