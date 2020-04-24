import { getCustomRepository, getRepository } from 'typeorm';
import AppError from '../errors/AppError';
import TransactionRepository from '../repositories/TransactionsRepository';
import Transactions from '../models/Transaction';
import Categories from '../models/Category';

interface Request {
  title: string;
  value: number;
  type: 'income' | 'outcome';
  category: string;
}

class CreateTransactionService {
  public async execute({
    title,
    value,
    type,
    category,
  }: Request): Promise<Transactions> {
    let category_: Categories;
    const transactionRepository = getCustomRepository(TransactionRepository);

    if (!['income', 'outcome'].includes(type))
      throw new AppError(`Transaction type ${type} is not valid`);

    const categoryRepository = getRepository(Categories);
    const { total } = await transactionRepository.getBalance();

    if (type === 'outcome' && total < value)
      throw new AppError('You do not have money for that');

    const checkCategoryExists = await categoryRepository.findOne({
      where: { title: category },
    });

    if (!checkCategoryExists) {
      const newCategory = await categoryRepository.create({ title: category });
      await categoryRepository.save(newCategory);

      category_ = newCategory;
    } else {
      category_ = checkCategoryExists;
    }

    const transaction = await transactionRepository.create({
      title,
      value,
      type,
      category: category_,
    });

    await transactionRepository.save(transaction);

    return transaction;
  }
}

export default CreateTransactionService;
