const isWithinOneHourOfBidding = (biddingStartDateTime) => {
    const currentTime = new Date();
    const oneHourBeforeBidding = new Date(biddingStartDateTime.getTime() - 60 * 60 * 1000);
    return currentTime >= oneHourBeforeBidding;
  };
  
  module.exports = isWithinOneHourOfBidding;
  