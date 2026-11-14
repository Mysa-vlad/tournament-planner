/**
 * spec D6: порт атомарної бізнес-операції. Сервіс оголошує межу «усе або нічого»,
 * не знаючи про SQL/BEGIN/COMMIT — реалізація живе в src/db/.
 */
export interface UnitOfWork {
  run<T>(operation: () => Promise<T>): Promise<T>;
}

/** Для прототипу на статичних даних: атомарності немає (одне ядро JS, без I/O між кроками). */
export const passthroughUnitOfWork: UnitOfWork = {
  run: (operation) => operation(),
};
