const { Audience } = require('./mongo');

const search = async (uid, searchText, tags) => {
    try{
        const searchQuery = searchText || tags ? { $or: [{ number: searchText }, { email: searchText}, { tags: tags }] } : {};
        return await Audience.find({ accountId: uid, ...searchQuery }).sort().limit(100);
    }catch (e) {
        logger.error(`Failed to search data in audience for user ${uid} -`, e);
        return Promise.reject(new customError('Failed to search data', 500));
    }
}


module.exports = {
    search
}
