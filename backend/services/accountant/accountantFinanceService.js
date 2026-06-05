const accountantFinanceRepository = require('../../repositories/accountant/accountantFinanceRepository');

const getFinanceStats = async () => {
    return accountantFinanceRepository.getFinanceStats();
};

module.exports = {
    getFinanceStats,
};
